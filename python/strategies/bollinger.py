
from .base import BaseStrategy


class BollingerStrategy(BaseStrategy):

    def __init__(self):
        super().__init__(
            name="Bollinger Bands Mean Reversion",
            params={
                "window": 20,
                "std_dev": 2.0
            }
        )

    def strategy(self, ohlcv ):

        middle = ohlcv["Close"].rolling(
            self.params["window"]
        ).mean()

        std = ohlcv["Close"].rolling(
            self.params["window"]
        ).std()

        upper = middle + (
            self.params["std_dev"] * std
        )

        lower = middle - (
            self.params["std_dev"] * std
        )

        # Buy when price crosses below the lower band
        entries = (
            (ohlcv["Close"] < lower) &
            (ohlcv["Close"].shift(1) >= lower.shift(1))
        )

        # Exit when price crosses above the middle band
        exits = (
            (ohlcv["Close"] > middle) &
            (ohlcv["Close"].shift(1) <= middle.shift(1))
        )

        return entries.fillna(False), exits.fillna(False)
