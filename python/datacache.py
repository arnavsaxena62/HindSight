"""
datacache.py
Disk cache for yfinance daily data. Ask for any symbols and date range, and it
downloads only what it doesn't already have.

    from datacache import get_prices, get_ohlcv

    close = get_prices(["AAPL", "MSFT"], "2021-11-23", "2026-11-23")   # Close, one column per symbol
    spy   = get_prices("SPY", "2021-11-23", "2026-11-23")["SPY"]
    df    = get_ohlcv("AAPL", "2021-11-23", "2026-11-23")              # Open High Low Close Volume

Dates follow yfinance: start is inclusive, end is exclusive. end=None means today (last full day).

Cache layout (plain csv, easy to inspect):
    data_cache/adj/AAPL.csv   prices
    data_cache/adj/AAPL.json  date range already covered for that symbol
Set DATA_CACHE_DIR or pass cache_dir= to move it.

Rules:
  * Only missing date ranges are downloaded. Symbols that need the same range go in one request.
  * Today's bar is never marked as covered, so it is refreshed on the next call.
  * Extending to the right re-fetches the last 7 days. If those prices differ from the cache
    (a split or dividend re-adjusted history), that symbol is rebuilt from scratch.
  * A download that returns nothing is not cached, so a network hiccup never poisons the cache.
"""
import json
import os
import re
import time
from pathlib import Path

import pandas as pd

DEFAULT_DIR = os.environ.get("DATA_CACHE_DIR", "data_cache")
OHLCV = ["Open", "High", "Low", "Close", "Volume"]
OVERLAP_DAYS = 7
ADJ_TOLERANCE = 1e-4


def _day(x):
    ts = pd.Timestamp(x)
    return (ts.tz_localize(None) if ts.tzinfo else ts).normalize()


def _paths(root, sym, auto_adjust):
    sub = Path(root) / ("adj" if auto_adjust else "raw")
    sub.mkdir(parents=True, exist_ok=True)
    name = re.sub(r"[^\w.=-]", "_", sym)
    return sub / f"{name}.csv", sub / f"{name}.json"


def _read(paths):
    csv, meta = paths
    if not (csv.exists() and meta.exists()):
        return None, None
    try:
        df = pd.read_csv(csv, index_col=0, parse_dates=True)
        m = json.loads(meta.read_text())
        if df.empty or "Close" not in df.columns or not isinstance(df.index, pd.DatetimeIndex):
            return None, None  # damaged file, rebuild it
        return df, (_day(m["start"]), _day(m["end"]))
    except Exception:
        return None, None  # unreadable file, rebuild it


def _write(paths, df, cov):
    csv, meta = paths
    tmp = csv.with_suffix(".tmp")
    df.to_csv(tmp)
    os.replace(tmp, csv)
    meta.write_text(json.dumps({
        "start": str(cov[0].date()), "end": str(cov[1].date()),
        "updated": time.strftime("%Y-%m-%d %H:%M:%S"),
    }))


def _tidy(df):
    if df is None or len(df) == 0:
        return pd.DataFrame(columns=OHLCV)
    df = df[[c for c in OHLCV if c in df.columns]].dropna(how="all").copy()
    idx = pd.DatetimeIndex(df.index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    df.index = idx.normalize()
    df.index.name = "Date"
    return df[~df.index.duplicated(keep="last")].sort_index()


def _download(symbols, start, end, auto_adjust):
    import yfinance as yf 
    raw = yf.download(symbols, start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"),
                      auto_adjust=auto_adjust, progress=False, group_by="ticker", threads=True)
    out = {s: pd.DataFrame() for s in symbols}
    if raw is None or raw.empty:
        return out
    if isinstance(raw.columns, pd.MultiIndex):
        # yfinance versions differ on which level holds the ticker
        lvl = 0 if set(raw.columns.get_level_values(0)) & set(symbols) else 1
        for s in symbols:
            if s in raw.columns.get_level_values(lvl):
                out[s] = _tidy(raw.xs(s, axis=1, level=lvl))
    elif len(symbols) == 1:
        out[symbols[0]] = _tidy(raw)
    return out


def _load(symbols, start, end, auto_adjust, refresh, root, verbose):
    today = _day(pd.Timestamp.today())
    start = _day(start)
    end = today if end is None else _day(end)
    state, jobs = {}, {}

    for s in symbols:
        paths = _paths(root, s, auto_adjust)
        df, cov = (None, None) if refresh else _read(paths)
        state[s] = [df, cov, paths]
        if df is None:
            jobs.setdefault((start, end), []).append(s)
            continue
        cs, ce = cov # type: ignore
        if start < cs:
            jobs.setdefault((start, cs), []).append(s)
        if end > ce:
            jobs.setdefault((max(cs, ce - pd.Timedelta(days=OVERLAP_DAYS)), end), []).append(s)

    dirty, downloaded = set(), set()
    for (a, b), syms in jobs.items():
        if verbose:
            print(f"[datacache] downloading {', '.join(syms)}  {a.date()} to {b.date()}")
        got = _download(syms, a, b, auto_adjust)
        for s in syms:
            new = got[s]
            df, cov, paths = state[s]
            if new.empty:
                if verbose:
                    print(f"[datacache] no data returned for {s} ({a.date()} to {b.date()}), not cached")
                continue
            downloaded.add(s)
            if df is None:
                df, cov = new, (a, min(b, today))
            else:
                both = df.index.intersection(new.index)
                moved = len(both) and ((df.loc[both, "Close"] / new.loc[both, "Close"] - 1).abs().max() > ADJ_TOLERANCE)
                if moved:  # split or dividend changed old prices, cached history is stale
                    if verbose:
                        print(f"[datacache] {s}: prices were re-adjusted, rebuilding")
                    ra, rb = min(cov[0], a), max(cov[1], b)
                    full = _download([s], ra, rb, auto_adjust)[s]
                    if not full.empty:
                        df, cov = full, (ra, min(rb, today))
                else:
                    df = _tidy(pd.concat([df, new]))
                    cov = (min(cov[0], a), max(cov[1], min(b, today)))
            state[s][0], state[s][1] = df, cov
            dirty.add(s)

    out = {}
    for s in symbols:
        df, cov, paths = state[s]
        if s in dirty:
            _write(paths, df, cov)
        out[s] = pd.DataFrame(columns=OHLCV) if df is None else df.loc[(df.index >= start) & (df.index < end)]
    if verbose and not jobs:
        print(f"[datacache] {len(symbols)} symbol(s) served from cache")
    return out


def _as_list(symbols):
    if isinstance(symbols, str):
        symbols = [symbols]
    return list(dict.fromkeys(s.strip() for s in symbols))


def get_ohlcv(symbols, start, end=None, auto_adjust=True, refresh=False, cache_dir=None, verbose=True):
    """Open/High/Low/Close/Volume for one symbol."""
    return {
        "Close": get_prices(symbols, start,end, "Close", auto_adjust, refresh, cache_dir),
        "Open": get_prices(symbols, start,end, "Open", auto_adjust, refresh, cache_dir),
        "Low": get_prices(symbols, start,end, "Low", auto_adjust, refresh, cache_dir),
        "High": get_prices(symbols, start,end, "High", auto_adjust, refresh, cache_dir),
        "Volume": get_prices(symbols, start,end, "Volume", auto_adjust, refresh, cache_dir)
    }

def get_prices(symbols, start, end=None, field="Close", auto_adjust=True, refresh=False,
               cache_dir=None, verbose=True):
    """One column per symbol for the chosen field (default Close), like yf.download()[field]."""
    syms = _as_list(symbols)
    data = _load(syms, start, end, auto_adjust, refresh, cache_dir or DEFAULT_DIR, verbose)
    frames = {s: d[field] for s, d in data.items() if len(d)}
    for s in syms:
        if s not in frames and verbose:
            print(f"[datacache] warning: no data for {s}")
    return pd.DataFrame(frames, columns=[s for s in syms if s in frames]).dropna(how="all")


def info(cache_dir=None, auto_adjust=True):
    """What is cached: symbol, covered range, rows, last update."""
    sub = Path(cache_dir or DEFAULT_DIR) / ("adj" if auto_adjust else "raw")
    rows = []
    for meta in sorted(sub.glob("*.json")):
        m = json.loads(meta.read_text())
        csv = meta.with_suffix(".csv")
        n = max(sum(1 for _ in open(csv)) - 1, 0) if csv.exists() else 0
        rows.append({"symbol": meta.stem, "from": m["start"], "to": m["end"], "rows": n, "updated": m["updated"]})
    return pd.DataFrame(rows)


def clear(symbols=None, cache_dir=None):
    """Delete cached data for some symbols, or everything if symbols is None."""
    root = Path(cache_dir or DEFAULT_DIR)
    for sub in ("adj", "raw"):
        for f in (root / sub).glob("*"):
            if symbols is None or f.stem in [re.sub(r"[^\w.=-]", "_", s) for s in _as_list(symbols)]:
                f.unlink()