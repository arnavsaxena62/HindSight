from abc import ABC, abstractmethod


class BaseStrategy(ABC):
    def __init__(self, name, params):
        self.name = name
        self.params = params

    @abstractmethod
    def strategy(self, ohlcv) -> tuple:
        """
        Takes a DataFrame of close data.

        Returns:
            entries: Boolean DataFrame
            exits: Boolean DataFrame
        """
        pass
