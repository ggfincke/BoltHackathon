# UPC lookup module

from .base_upc_lookup import BaseUPCLookup, UPCResult
from .barcode_lookup import BarcodeLookupService
from .upc_manager import UPCManager, create_upc_manager

# additional services 
try:
    __all__ = [
        'BaseUPCLookup',
        'UPCResult', 
        'BarcodeLookupService',
        'UPCManager',
        'create_upc_manager',
        'UPCDatabaseService',
        'GoogleShoppingUPCService',
        'AmazonUPCService',
        'create_upcdatabase_service',
        'create_google_shopping_service'
    ]
except ImportError:
    # error
    __all__ = [
        'BaseUPCLookup',
        'UPCResult', 
        'BarcodeLookupService',
        'UPCManager',
        'create_upc_manager'
    ]