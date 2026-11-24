
from .base import BaseStrategy


class RSIStrategy(BaseStrategy):

    def __init__(self):
        super().__init__(
            name="RSI Mean Reversion",
            params={
                "window": 14,
                "oversold": 30,
                "overbought": 70
            }
        )

    def strategy(self, ohlcv):

        delta = ohlcv["Close"].diff()

        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)

        avg_gain = gain.ewm(
            alpha=1 / self.params["window"],
            adjust=False
        ).mean()

        avg_loss = loss.ewm(
            alpha=1 / self.params["window"],
            adjust=False
        ).mean()

        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))

        entries = (
            (rsi < self.params["oversold"]) &
            (rsi.shift(1) >= self.params["oversold"])
        )

        exits = (
            (rsi > self.params["overbought"]) &
            (rsi.shift(1) <= self.params["overbought"])
        )

        return entries.fillna(False), exits.fillna(False)
