import pkgutil
import importlib
import inspect

import pandas as pd
import vectorbt as vbt

from strategies.base import BaseStrategy
from datacache import get_prices, get_ohlcv
from export_run import export_run


# ============================================================
# SETTINGS
# ============================================================

SYMBOLS = ["AAPL", "MSFT", "GOOG", "AMZN", "META", "NVDA", "JPM", "XOM"]

BENCHMARK = "SPY"

START = "2020-11-23"
END = "2026-11-23"

CAPITAL = 1_000_000
FEES = 0.001
RF = 0.0381


# ============================================================
# STRATEGY DISCOVERY
# ============================================================


def discover_strategies():

    strategies = []

    package = importlib.import_module("strategies")

    for _, module_name, _ in pkgutil.iter_modules(package.__path__):
        if module_name == "base":
            continue

        module = importlib.import_module(f"strategies.{module_name}")

        for _, cls in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(cls, BaseStrategy)
                and cls is not BaseStrategy
                and cls.__module__ == module.__name__
            ):
                strategies.append(cls())

    return strategies


# ============================================================
# STRATEGY SELECTION
# ============================================================


def select_strategy(strategies):

    if not strategies:
        raise RuntimeError("No strategies found!")

    print("\n========== AVAILABLE STRATEGIES ==========\n")

    for i, strat in enumerate(strategies, start=1):
        print(f"{i}. {strat.name}")

    while True:
        try:
            choice = int(input("\nSelect strategy: "))

            if 1 <= choice <= len(strategies):
                break

            print("Invalid selection.")

        except ValueError:
            print("Please enter a number.")

    selected = strategies[choice - 1]

    print(f"\nSelected: {selected.name}")
    print("\n========== PARAMETERS ==========\n")

    for param, default in selected.params.items():
        while True:
            raw = input(f"{param} [{default}]: ").strip()

            if not raw:
                break

            try:
                if isinstance(default, bool):
                    if raw.lower() not in ("true", "false"):
                        raise ValueError("Enter true or false")

                    selected.params[param] = raw.lower() == "true"

                elif isinstance(default, int):
                    selected.params[param] = int(raw)

                elif isinstance(default, float):
                    selected.params[param] = float(raw)

                elif isinstance(default, str):
                    selected.params[param] = raw

                break

            except ValueError as e:
                print(f"Invalid value: {e}")

    print("\n========== CONFIGURATION ==========\n")

    print(f"Strategy: {selected.name}")

    for key, value in selected.params.items():
        print(f"{key}: {value}")

    return selected


# ============================================================
# DATA RETRIEVAL
# ============================================================


def load_data():

    print("\nLoading stock data...")

    # Load OHLC data for all symbols
    ohlcv = get_ohlcv(SYMBOLS, START, END)

    # Load benchmark data
    bench = get_prices(BENCHMARK, START, END)[BENCHMARK]

    return ohlcv, bench


# ============================================================
# BACKTEST ENGINE
# ============================================================


def run_backtest(selected, ohlcv, bench):

    print("\nGenerating trading signals...")

    entries, exits = selected.strategy(ohlcv)

    print("Building portfolio...")

    pf = vbt.Portfolio.from_signals(
        ohlcv["Close"],
        entries,
        exits,
        init_cash=CAPITAL,
        size=CAPITAL / len(SYMBOLS),
        size_type="value",
        fees=FEES,
        freq="1D",
        group_by=True,
        cash_sharing=True,
    )

    print("\n========== PERFORMANCE ==========\n")

    print(
        pf.stats(
            settings=dict(
                year_freq="252 days", risk_free=RF / 252, required_return=RF / 252
            )
        )
    )

    # ========================================================
    # EXPORT
    # ========================================================

    export_run(
        pf,
        name=f"{selected.name} {' '.join(map(str, selected.params.values()))}",
        strategy=selected.name,
        benchmark_close=bench,
        benchmark_name=BENCHMARK,
        params=selected.params,
        rf=RF,
    )

    print("\nBacktest completed successfully!")

    return pf


# ============================================================
# MAIN
# ============================================================


def main():

    print("\n========================================")
    print("         VECTORBT BACKTEST ENGINE")
    print("========================================")

    strategies = discover_strategies()

    print(f"\nDiscovered {len(strategies)} strategies.")

    selected = select_strategy(strategies)

    ohlcv, bench = load_data()

    pf = run_backtest(selected, ohlcv, bench)

    return pf


if __name__ == "__main__":
    main()
