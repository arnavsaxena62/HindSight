# strategies/combined.py
from .base import BaseStrategy
from .donchian import Donchian
from .bollinger_olhc import Bollinger


class Combined(BaseStrategy):
    def __init__(
        self,
        days=3,
        exit_mode="either",
        donchian_window=20,
        bollinger_window=20,
        bollinger_num_std=2.0,
    ):
        super().__init__(
            name="donchian+bollinger",
            params={
                "days": days,
                "exit_mode": exit_mode,  # "either" or "both"
                "donchian_window": donchian_window,
                "bollinger_window": bollinger_window,
                "bollinger_num_std": bollinger_num_std,
            },
        )

    @staticmethod
    def _within(sig_a, sig_b, days):
        """
        True on the bar where the second of the two signals fires,
        as long as the first fired on the same bar or in the previous `days` bars.
        Only uses past and current bars, so no lookahead.
        """
        a_recent = sig_a.astype(float).rolling(days + 1, min_periods=1).max().astype(bool)
        b_recent = sig_b.astype(float).rolling(days + 1, min_periods=1).max().astype(bool)
        return (sig_a & b_recent) | (sig_b & a_recent)

    def strategy(self, ohlcv) -> tuple:
        """
        Takes a dict of wide DataFrames with keys open, high, low, close, volume.
        Each DataFrame has dates as rows and symbols as columns.

        Returns:
            entries: Boolean DataFrame
            exits: Boolean DataFrame
        """
        p = self.params

        # built here so params edited in the prompt are used
        donchian = Donchian(window=p["donchian_window"])
        bollinger = Bollinger(window=p["bollinger_window"], num_std=p["bollinger_num_std"])

        entries_a, exits_a = donchian.strategy(ohlcv)
        entries_b, exits_b = bollinger.strategy(ohlcv)

        entries = self._within(entries_a, entries_b, p["days"])

        if p["exit_mode"] == "both":
            exits = self._within(exits_a, exits_b, p["days"])
        else:
            exits = exits_a | exits_b

        return entries, exits