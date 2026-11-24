"""
export_run.py
Turns a vectorbt Portfolio into runs/<id>.json, updates runs/index.json,
and rebuilds report.html (one file with all runs inlined).
All math happens here. The viewer only draws.

Portfolio must be built as ONE grouped portfolio so equity/cash are single series:
    pf = vbt.Portfolio.from_signals(close, entries, exits, init_cash=1_000_000,
                                    group_by=True, cash_sharing=True, fees=0.001)
"""
import json
import time
from pathlib import Path

import numpy as np
import pandas as pd

PPY = 252  # periods per year (daily bars)


def _secs(idx):
    idx = pd.DatetimeIndex(idx)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    return ((idx - pd.Timestamp("1970-01-01")) // pd.Timedelta("1s")).astype(int).tolist()


def _clean(s, nd=6):
    return [None if not np.isfinite(v) else round(float(v), nd) for v in np.asarray(s, dtype=float)]


def _pick(df, *names):
    for n in names:
        if n in df.columns:
            return df[n]
    raise KeyError(f"none of {names} in trade columns {list(df.columns)}")


def _trades(pf):
    t = pf.trades.records_readable.copy()
    out = pd.DataFrame({
        "symbol": _pick(t, "Column").astype(str),
        "dir": _pick(t, "Direction").astype(str),
        "entry": pd.to_datetime(_pick(t, "Entry Timestamp", "Entry Index")),
        "exit": pd.to_datetime(_pick(t, "Exit Timestamp", "Exit Index")),
        "size": _pick(t, "Size").astype(float),
        "entry_px": _pick(t, "Avg Entry Price").astype(float),
        "exit_px": _pick(t, "Avg Exit Price").astype(float),
        "pnl": _pick(t, "PnL").astype(float),
        "ret": _pick(t, "Return").astype(float),
        "status": _pick(t, "Status").astype(str),
    })
    return out.sort_values("entry").reset_index(drop=True)


def _positions_series(trades, index):
    """number of open positions on each bar"""
    n = np.zeros(len(index))
    idx = pd.DatetimeIndex(index)
    if idx.tz is not None:
        idx = idx.tz_localize(None)
    for e, x in zip(trades["entry"], trades["exit"]):
        a = idx.searchsorted(e)
        b = idx.searchsorted(x, side="right")
        n[a:b] += 1
    return pd.Series(n, index=index)


def export_run(pf, name, strategy, benchmark_close, benchmark_name="SPY",
               rf=0.0381, out_dir="runs", params=None, notes=None):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)

    eq = pf.value()
    if isinstance(eq, pd.DataFrame):
        eq = eq.iloc[:, 0]
    cash = pf.cash()
    if isinstance(cash, pd.DataFrame):
        cash = cash.iloc[:, 0]
    gross = pf.gross_exposure() if hasattr(pf, "gross_exposure") else (eq - cash) / eq
    net = pf.net_exposure() if hasattr(pf, "net_exposure") else gross
    if isinstance(gross, pd.DataFrame):
        gross = gross.iloc[:, 0]
    if isinstance(net, pd.DataFrame):
        net = net.iloc[:, 0]
    gross, net = gross.fillna(0), net.fillna(0)

    bench = benchmark_close.reindex(eq.index).ffill().bfill()
    bench_eq = bench / bench.iloc[0] * eq.iloc[0]

    trades = _trades(pf)
    pos = _positions_series(trades, eq.index)

    # ---- metrics ----
    r = eq.pct_change().dropna()
    years = (eq.index[-1] - eq.index[0]).days / 365.25
    total = eq.iloc[-1] / eq.iloc[0] - 1
    cagr = (1 + total) ** (1 / years) - 1
    excess = r - rf / PPY
    sharpe = excess.mean() / r.std() * np.sqrt(PPY) if r.std() > 0 else 0
    ddev = np.sqrt((np.minimum(excess, 0) ** 2).mean())  # downside deviation, target = rf
    sortino = excess.mean() / ddev * np.sqrt(PPY) if ddev > 0 else 0
    dd = eq / eq.cummax() - 1
    closed = trades[trades["status"].str.lower() == "closed"]  # same basis as vectorbt stats
    wins = closed[closed["pnl"] > 0]
    losses = closed[closed["pnl"] < 0]
    pf_ratio = wins["pnl"].sum() / abs(losses["pnl"].sum()) if len(losses) else None

    metrics = {
        "total_return": total,
        "cagr": cagr,
        "start_value": float(eq.iloc[0]),
        "end_value": float(eq.iloc[-1]),
        "years": years,
        "sharpe": sharpe,
        "sortino": sortino,
        "max_drawdown": float(dd.min()),
        "max_drawdown_date": dd.idxmin().strftime("%Y-%m-%d"),
        "volatility": float(r.std() * np.sqrt(PPY)),
        "win_rate": len(wins) / len(closed) if len(closed) else None,
        "wins": int(len(wins)),
        "trade_count": int(len(closed)),
        "profit_factor": pf_ratio,
        "rf": rf,
        "bench_return": float(bench_eq.iloc[-1] / bench_eq.iloc[0] - 1),
    }
    invested = gross > 0.001
    exposure = {
        "time_in_market": float(invested.mean()),
        "avg_gross": float(gross.mean()),
        "max_gross": float(gross.max()),
        "avg_net": float(net.mean()),
        "avg_positions": float(pos[invested].mean()) if invested.any() else 0.0,
        "max_positions": int(pos.max()),
        "long_share": float((trades["dir"].str.lower() == "long").mean()) if len(trades) else 1.0,
    }

    symbols = sorted(trades["symbol"].unique().tolist())
    run_id = time.strftime("%Y%m%d-%H%M%S")
    run = {
        "id": run_id,
        "name": name,
        "strategy": strategy,
        "params": params or {},
        "notes": notes or [],
        "symbols": symbols,
        "benchmark": benchmark_name,
        "capital": float(eq.iloc[0]),
        "start": eq.index[0].strftime("%Y-%m-%d"),
        "end": eq.index[-1].strftime("%Y-%m-%d"),
        "metrics": {k: (None if v is None else (round(v, 6) if isinstance(v, float) else v))
                    for k, v in metrics.items()},
        "exposure": {k: round(v, 6) if isinstance(v, float) else v for k, v in exposure.items()},
        "series": {
            "t": _secs(eq.index),
            "equity": _clean(eq, 2),
            "bench": _clean(bench_eq, 2),
            "drawdown": _clean(dd),
            "gross": _clean(gross),
            "net": _clean(net),
            "cash": _clean(cash, 2),
            "positions": _clean(pos, 0),
        },
        "trades": [
            {
                "symbol": row.symbol, "dir": row.dir,
                "entry": row.entry.strftime("%Y-%m-%d"), "exit": row.exit.strftime("%Y-%m-%d"),
                "size": round(row.size, 4), "entry_px": round(row.entry_px, 4),
                "exit_px": round(row.exit_px, 4), "pnl": round(row.pnl, 2), "ret": round(row.ret, 6),
                "status": row.status,
            }
            for row in trades.itertuples()
        ],
    }
    (out / f"{run_id}.json").write_text(json.dumps(run))

    # ---- index ----
    idx_path = out / "index.json"
    index = json.loads(idx_path.read_text()) if idx_path.exists() else []
    index.insert(0, {
        "id": run_id, "name": name, "strategy": strategy, "symbols": symbols,
        "start": run["start"], "end": run["end"],
        "total_return": metrics["total_return"], "cagr": metrics["cagr"],
        "sharpe": metrics["sharpe"], "max_drawdown": metrics["max_drawdown"],
    })
    idx_path.write_text(json.dumps(index, default=float))
    print(f"wrote {out / (run_id + '.json')}")
    return run_id


def build_bundle(out_dir="runs", viewer="viewer.html", out_file=None):
    """Inline index + every run json into one html file that works from file://"""
    out = Path(out_dir)
    viewer_path = Path(viewer)
    if not viewer_path.exists():
        viewer_path = Path(__file__).parent / "viewer.html"
    index = json.loads((out / "index.json").read_text())
    runs = {}
    for e in index:
        p = out / f"{e['id']}.json"
        if p.exists():
            runs[e["id"]] = json.loads(p.read_text())
    blob = json.dumps({"index": [e for e in index if e["id"] in runs], "runs": runs}).replace("</", "<\\/")
    html = viewer_path.read_text().replace("<!--BUNDLE-->", f"<script>window.BUNDLE={blob};</script>")
    target = Path(out_file) if out_file else out.parent / "report.html"
    target.write_text(html)
    print(f"wrote {target} ({target.stat().st_size / 1e6:.1f} MB, {len(runs)} runs)")


if __name__ == "__main__":
    import vectorbt as vbt
    import yfinance as yf

    syms = ["AAPL", "MSFT", "GOOG", "AMZN", "META", "NVDA", "JPM", "XOM"]
    close = yf.download(syms, start="2021-11-23", end="2026-11-23", auto_adjust=True)["Close"]
    spy = yf.download("SPY", start="2021-11-23", end="2026-11-23", auto_adjust=True)["Close"].squeeze()

    bb = vbt.BBANDS.run(close, window=20, alpha=2)
    rsi = vbt.RSI.run(close, window=14)
    entries = (close < bb.lower) & (rsi.rsi < 30)
    exits = (close > bb.middle) | (rsi.rsi > 60)

    pf = vbt.Portfolio.from_signals(
        close, entries, exits, init_cash=1_000_000, size=1_000_000 / 8, size_type="value",
        group_by=True, cash_sharing=True, fees=0.001,
    )
    export_run(pf, "Bollinger + RSI, 8 large caps", "Bollinger + RSI", spy,
               params={"bb_window": 20, "bb_alpha": 2, "rsi_window": 14})