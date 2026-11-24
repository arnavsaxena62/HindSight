# strategies/bollinger.py
from .base import BaseStrategy


class Bollinger(BaseStrategy):
    def __init__(self, window=20, num_std=2.0):
        super().__init__(
            name="bollinger with ohlcv",
            params={"window": window, "num_std": num_std},
        )

    def strategy(self, ohlcv) -> tuple:
        """
        Takes a dict of wide DataFrames with keys open, high, low, close, volume.
        Each DataFrame has dates as rows and symbols as columns.

        Returns:
            entries: Boolean DataFrame
            exits: Boolean DataFrame
        """
        w = self.params["window"]
        k = self.params["num_std"]
        close = ohlcv["Close"]

        mid = close.rolling(w).mean()
        std = close.rolling(w).std()

        # shift(1) so the bands come from the previous bar, since today's
        # close is not known while today's high or low is being hit
        upper = (mid + k * std).shift(1)
        lower = (mid - k * std).shift(1)

        entries = ohlcv["High"] >= upper
        exits = ohlcv["Low"] <= lower

        return entries, exits