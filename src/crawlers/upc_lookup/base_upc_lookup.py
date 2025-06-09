from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from dataclasses import dataclass
import logging

# UPCResult class (result from lookup)
@dataclass
class UPCResult:
    upc: Optional[str]
    confidence_score: float 
    source_service: str
    product_title: str
    metadata: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

# BaseUPCLookup class (abstract base class)
class BaseUPCLookup(ABC):    
    def __init__(self, logger: logging.Logger = None):
        self.logger = logger or logging.getLogger(__name__)
        self.service_name = self.__class__.__name__
    
    # lookup UPC for a product name  
    @abstractmethod
    def lookup_upc(self, product_name: str) -> UPCResult:
        pass
    
    # check if service is available
    @abstractmethod
    def is_available(self) -> bool:
        pass
    
    # cleanup
    def cleanup(self) -> None:
        pass