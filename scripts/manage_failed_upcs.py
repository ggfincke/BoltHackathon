# management script for handling failed UPC lookups

import os
import sys
import argparse
import logging
from typing import Optional

# add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from supabase import create_client
from crawlers.upc_lookup import create_failed_upc_manager, create_upc_manager


# setup logging configuration
def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )
    return logging.getLogger(__name__)


# get Supabase client from environment variables
def get_supabase_client():
    url = os.getenv('SUPABASE_URL')
    key = os.getenv('SUPABASE_ANON_KEY')
    
    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY environment variables must be set")
    
    return create_client(url, key)

# list pending failed UPC lookups
def list_pending(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.get_pending_reviews(limit=args.limit, offset=args.offset)
    
    if result["success"]:
        print(f"\n📋 Found {result['count']} pending failed UPC lookups:")
        print("-" * 80)
        
        for item in result["data"]:
            print(f"ID: {item['id']}")
            print(f"Product: {item['product_name']}")
            print(f"Retailer: {item.get('retailer_source', 'Unknown')}")
            print(f"Retry Count: {item['retry_count']}")
            print(f"Created: {item['created_at']}")
            print(f"Reason: {item.get('failure_reason', 'N/A')}")
            print("-" * 40)
    else:
        print(f"❌ Error: {result['error']}")

# show statistics about failed UPC lookups
def show_statistics(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.get_statistics()
    
    if result["success"]:
        stats = result["data"]
        print("\n📊 Failed UPC Lookup Statistics:")
        print("-" * 40)
        print(f"Total Records: {stats['total_count']}")
        print(f"Pending: {stats['pending_count']}")
        print(f"In Review: {stats['in_review_count']}")
        print(f"Resolved: {stats['resolved_count']}")
        print(f"Ignored: {stats['ignored_count']}")
        print(f"Success Rate: {stats['success_rate']:.2%}")
        print(f"Average Retries: {stats['avg_retry_count']:.1f}")
        print(f"Max Retries: {stats['max_retry_count']}")
    else:
        print(f"❌ Error: {result['error']}")

# assign a failed lookup to a user for review
def assign_review(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.assign_for_review(args.lookup_id, args.user_id)
    
    if result["success"]:
        print(f"✅ Successfully assigned lookup {args.lookup_id} to user {args.user_id}")
    else:
        print(f"❌ Error: {result['error']}")

# resolve a failed lookup with manual UPC
def resolve_lookup(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.resolve_with_upc(
        lookup_id=args.lookup_id,
        manual_upc=args.upc,
        confidence=args.confidence,
        notes=args.notes
    )
    
    if result["success"]:
        print(f"✅ Successfully resolved lookup {args.lookup_id} with UPC {args.upc}")
    else:
        print(f"❌ Error: {result['error']}")

# mark a failed lookup as ignored
def ignore_lookup(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.mark_as_ignored(args.lookup_id, args.reason)
    
    if result["success"]:
        print(f"✅ Successfully marked lookup {args.lookup_id} as ignored")
    else:
        print(f"❌ Error: {result['error']}")

# retry failed UPC lookups
def retry_failed(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    upc_manager = create_upc_manager(logger, supabase)
    
    result = failed_upc_manager.retry_failed_lookups(
        upc_manager=upc_manager,
        max_retries=args.max_retries,
        limit=args.limit
    )
    
    if result["success"]:
        data = result["data"]
        print(f"🔄 Retry Results:")
        print(f"Attempted: {data['attempted']}")
        print(f"Successful: {data['successful']}")
        print(f"Still Failed: {data['failed']}")
        
        if args.verbose and data['details']:
            print("\nDetails:")
            for detail in data['details']:
                print(f"  {detail['product_name']}: {detail['status']}")
                if detail.get('upc'):
                    print(f"    UPC: {detail['upc']}")
    else:
        print(f"❌ Error: {result['error']}")

# search failed lookups by product name
def search_lookups(args):
    logger = setup_logging(args.verbose)
    supabase = get_supabase_client()
    failed_upc_manager = create_failed_upc_manager(supabase, logger)
    
    result = failed_upc_manager.search_failed_lookups(args.search_term, limit=args.limit)
    
    if result["success"]:
        print(f"\n🔍 Found {result['count']} results for '{args.search_term}':")
        print("-" * 80)
        
        for item in result["data"]:
            print(f"ID: {item['id']}")
            print(f"Product: {item['product_name']}")
            print(f"Status: {item['status']}")
            print(f"Retailer: {item.get('retailer_source', 'Unknown')}")
            if item.get('manual_upc'):
                print(f"UPC: {item['manual_upc']}")
            print("-" * 40)
    else:
        print(f"❌ Error: {result['error']}")

# main function
def main():
    parser = argparse.ArgumentParser(description="Manage failed UPC lookups")
    parser.add_argument('-v', '--verbose', action='store_true', help='Verbose output')
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # List pending command
    list_parser = subparsers.add_parser('list', help='List pending failed lookups')
    list_parser.add_argument('--limit', type=int, default=20, help='Number of records to show')
    list_parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')
    list_parser.set_defaults(func=list_pending)
    
    # Statistics command
    stats_parser = subparsers.add_parser('stats', help='Show statistics')
    stats_parser.set_defaults(func=show_statistics)
    
    # Assign command
    assign_parser = subparsers.add_parser('assign', help='Assign lookup to user')
    assign_parser.add_argument('lookup_id', help='Failed lookup ID')
    assign_parser.add_argument('user_id', help='User ID to assign to')
    assign_parser.set_defaults(func=assign_review)
    
    # Resolve command
    resolve_parser = subparsers.add_parser('resolve', help='Resolve lookup with UPC')
    resolve_parser.add_argument('lookup_id', help='Failed lookup ID')
    resolve_parser.add_argument('upc', help='UPC code')
    resolve_parser.add_argument('confidence', type=float, help='Confidence score (0.0-1.0)')
    resolve_parser.add_argument('--notes', help='Optional notes')
    resolve_parser.set_defaults(func=resolve_lookup)
    
    # Ignore command
    ignore_parser = subparsers.add_parser('ignore', help='Mark lookup as ignored')
    ignore_parser.add_argument('lookup_id', help='Failed lookup ID')
    ignore_parser.add_argument('--reason', help='Reason for ignoring')
    ignore_parser.set_defaults(func=ignore_lookup)
    
    # Retry command
    retry_parser = subparsers.add_parser('retry', help='Retry failed lookups')
    retry_parser.add_argument('--max-retries', type=int, default=3, help='Max retry count')
    retry_parser.add_argument('--limit', type=int, default=10, help='Number of lookups to retry')
    retry_parser.set_defaults(func=retry_failed)
    
    # Search command
    search_parser = subparsers.add_parser('search', help='Search failed lookups')
    search_parser.add_argument('search_term', help='Product name to search for')
    search_parser.add_argument('--limit', type=int, default=20, help='Number of results to show')
    search_parser.set_defaults(func=search_lookups)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    try:
        args.func(args)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main() 