# strategies/donchian.py
from .base import BaseStrategy


class Donchian(BaseStrategy):
    def __init__(self, window=20):
        super().__init__(
            name="Donchian",
            params={"window": window},
        )

    def strategy(self, ohlcv) -> tuple:
        """
        Takes a dict of wide DataFrames (open, high, low, close, volume),
        each with dates as rows and symbols as columns.

        Returns:
            entries: Boolean DataFrame
            exits: Boolean DataFrame
        """
        w = self.params["window"]
        close = ohlcv["Close"]

        # shift(1) so today's bar is not part of its own breakout level
        upper = ohlcv["High"].rolling(w).max().shift(1)
        lower = ohlcv["Low"].rolling(w).min().shift(1)

        entries = close > upper
        exits = close < lower

        return entries, exits