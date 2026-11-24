
import pandas as pd
from .base import BaseStrategy


class SMAStrategy(BaseStrategy):

    def __init__(self):
        super().__init__(
            name="SMA Crossover + Trend Filter",
            params={
                "fast": 20,
                "slow": 50,
                "trend": 200
            }
        )

    def strategy(self, ohlcv):

        fast = ohlcv["Close"].rolling(self.params["fast"]).mean()
        slow = ohlcv["Close"].rolling(self.params["slow"]).mean()
        trend = ohlcv["Close"].rolling(self.params["trend"]).mean()

        cross_up = (
            (fast > slow) &
            (fast.shift(1) <= slow.shift(1))
        )

        cross_down = (
            (fast < slow) &
            (fast.shift(1) >= slow.shift(1))
        )

        entries = cross_up & (ohlcv["Close"] > trend)
        exits = cross_down

        return entries.fillna(False), exits.fillna(False)
