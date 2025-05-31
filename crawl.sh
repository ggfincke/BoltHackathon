#!/bin/bash

# Crawler Shell Wrapper
# This script provides convenient shortcuts for common crawler operations

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRAWL_SCRIPT="$SCRIPT_DIR/crawl.py"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show usage information
show_usage() {
    echo "Crawler Shell Wrapper"
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  quick-amazon              Quick Amazon full crawl (5 pages per category)"
    echo "  quick-target              Quick Target full crawl (5 pages per category)"
    echo "  urls-amazon               Amazon URL-only crawl to Redis"
    echo "  urls-target               Target URL-only crawl to Redis"
    echo "  hierarchy-amazon          Amazon hierarchical full crawl"
    echo "  hierarchy-target          Target hierarchical full crawl"
    echo "  hierarchy-urls-amazon     Amazon hierarchical URL crawl"
    echo "  hierarchy-urls-target     Target hierarchical URL crawl"
    echo ""
    echo "Hierarchy File Commands (NEW):"
    echo "  from-hierarchy-amazon     Amazon crawl from existing hierarchy file (full mode)"
    echo "  from-hierarchy-target     Target crawl from existing hierarchy file (full mode)"
    echo "  from-hierarchy-urls-amazon  Amazon crawl from hierarchy file (URLs only)"
    echo "  from-hierarchy-urls-target  Target crawl from hierarchy file (URLs only)"
    echo ""
    echo "Utility Commands:"
    echo "  list                      List available retailers"
    echo "  test-redis                Test Redis connection"
    echo "  help                      Show this help message"
    echo ""
    echo "Options (passed through to crawl.py):"
    echo "  --category CATEGORY       Specific category to crawl"
    echo "  --max-pages N             Maximum pages per category"
    echo "  --concurrency N           Number of concurrent grid crawlers (hierarchy file mode)"
    echo "  --output PREFIX           Output file prefix"
    echo "  --log-level LEVEL         Logging level (DEBUG, INFO, WARNING, ERROR)"
    echo ""
    echo "Examples:"
    echo "  $0 quick-amazon"
    echo "  $0 urls-target --category \"Beverages\""
    echo "  $0 hierarchy-amazon --max-pages 3 --output my_crawl"
    echo "  $0 from-hierarchy-amazon --concurrency 10 --max-pages 2"
    echo "  $0 from-hierarchy-urls-target custom_hierarchy.json --concurrency 8"
    echo ""
    echo "Direct crawl.py usage:"
    echo "  $0 -- --retailer amazon --mode full --hierarchical --category \"Electronics\""
}

# Check if Python script exists
if [[ ! -f "$CRAWL_SCRIPT" ]]; then
    print_error "crawl.py not found at $CRAWL_SCRIPT"
    exit 1
fi

# If no arguments, show usage
if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

COMMAND="$1"
shift  # Remove command from arguments

case "$COMMAND" in
    quick-amazon)
        print_info "Starting quick Amazon crawl (full mode, 5 pages per category)"
        python "$CRAWL_SCRIPT" --retailer amazon --mode full --max-pages 5 "$@"
        print_success "Amazon crawl completed"
        ;;
    
    quick-target)
        print_info "Starting quick Target crawl (full mode, 5 pages per category)"
        python "$CRAWL_SCRIPT" --retailer target --mode full --max-pages 5 "$@"
        print_success "Target crawl completed"
        ;;
    
    urls-amazon)
        print_info "Starting Amazon URL-only crawl to Redis"
        python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only "$@"
        print_success "Amazon URL crawl completed"
        ;;
    
    urls-target)
        print_info "Starting Target URL-only crawl to Redis"
        python "$CRAWL_SCRIPT" --retailer target --mode urls-only "$@"
        print_success "Target URL crawl completed"
        ;;
    
    hierarchy-amazon)
        print_info "Starting Amazon hierarchical crawl (full mode)"
        python "$CRAWL_SCRIPT" --retailer amazon --mode full --hierarchical "$@"
        print_success "Amazon hierarchical crawl completed"
        ;;
    
    hierarchy-target)
        print_info "Starting Target hierarchical crawl (full mode)"
        python "$CRAWL_SCRIPT" --retailer target --mode full --hierarchical "$@"
        print_success "Target hierarchical crawl completed"
        ;;
    
    hierarchy-urls-amazon)
        print_info "Starting Amazon hierarchical URL crawl"
        python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only --hierarchical "$@"
        print_success "Amazon hierarchical URL crawl completed"
        ;;
    
    hierarchy-urls-target)
        print_info "Starting Target hierarchical URL crawl"
        python "$CRAWL_SCRIPT" --retailer target --mode urls-only --hierarchical "$@"
        print_success "Target hierarchical URL crawl completed"
        ;;
    
    from-hierarchy-amazon)
        print_info "Starting Amazon crawl from hierarchy file (full mode)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # First argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer amazon --mode full --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # Use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer amazon --mode full --from-hierarchy-file "" "$@"
        fi
        print_success "Amazon hierarchy file crawl completed"
        ;;
    
    from-hierarchy-target)
        print_info "Starting Target crawl from hierarchy file (full mode)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # First argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer target --mode full --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # Use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer target --mode full --from-hierarchy-file "" "$@"
        fi
        print_success "Target hierarchy file crawl completed"
        ;;
    
    from-hierarchy-urls-amazon)
        print_info "Starting Amazon crawl from hierarchy file (URLs only)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # First argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # Use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only --from-hierarchy-file "" "$@"
        fi
        print_success "Amazon hierarchy file URL crawl completed"
        ;;
    
    from-hierarchy-urls-target)
        print_info "Starting Target crawl from hierarchy file (URLs only)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # First argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer target --mode urls-only --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # Use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer target --mode urls-only --from-hierarchy-file "" "$@"
        fi
        print_success "Target hierarchy file URL crawl completed"
        ;;
    
    list)
        python "$CRAWL_SCRIPT" --list-retailers
        ;;
    
    test-redis)
        print_info "Testing Redis connection..."
        python "$CRAWL_SCRIPT" --test-redis
        ;;
    
    help|--help|-h)
        show_usage
        ;;
    
    --)
        # Pass through mode - run crawl.py directly with remaining arguments
        print_info "Running crawl.py directly with arguments: $*"
        python "$CRAWL_SCRIPT" "$@"
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac 