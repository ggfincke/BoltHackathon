# Crawler shell wrapper

# exit on error
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRAWL_SCRIPT="$SCRIPT_DIR/crawl.py"

# color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# helper functions
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

# run command with error handling
run_crawler() {
    local command_name="$1"
    local success_message="$2"
    shift 2
    
    print_info "$command_name"
    if python "$CRAWL_SCRIPT" "$@"; then
        print_success "$success_message"
    else
        print_error "Command failed: $command_name"
        exit 1
    fi
}

# usage info
show_usage() {
    echo "Crawler Shell Wrapper"
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Quick Commands:"
    echo "  quick-amazon              Quick Amazon full crawl (5 pages per category)"
    echo "  quick-target              Quick Target full crawl (5 pages per category)"
    echo "  quick-walmart             Quick Walmart full crawl (5 pages per category)"
    echo ""
    echo "URL-Only Commands:"
    echo "  urls-amazon               Amazon URL-only crawl"
    echo "  urls-target               Target URL-only crawl"
    echo "  urls-walmart              Walmart URL-only crawl"
    echo ""
    echo "Hierarchical Commands:"
    echo "  hierarchy-amazon          Amazon hierarchical full crawl"
    echo "  hierarchy-target          Target hierarchical full crawl"
    echo "  hierarchy-walmart         Walmart hierarchical full crawl"
    echo "  hierarchy-urls-amazon     Amazon hierarchical URL crawl"
    echo "  hierarchy-urls-target     Target hierarchical URL crawl"
    echo "  hierarchy-urls-walmart    Walmart hierarchical URL crawl"
    echo ""
    echo "Hierarchy File Commands:"
    echo "  from-hierarchy-amazon     Amazon crawl from existing hierarchy file (full mode)"
    echo "  from-hierarchy-target     Target crawl from existing hierarchy file (full mode)"
    echo "  from-hierarchy-walmart    Walmart crawl from existing hierarchy file (full mode)"
    echo "  from-hierarchy-urls-amazon  Amazon crawl from hierarchy file (URLs only)"
    echo "  from-hierarchy-urls-target  Target crawl from hierarchy file (URLs only)"
    echo "  from-hierarchy-urls-walmart Walmart crawl from hierarchy file (URLs only)"
    echo ""
    echo "Supabase Backend Commands:"
    echo "  supabase-amazon           Amazon full crawl to Supabase database"
    echo "  supabase-target           Target full crawl to Supabase database"
    echo "  supabase-walmart          Walmart full crawl to Supabase database"
    echo ""
    echo "Utility Commands:"
    echo "  list                      List available retailers"
    echo "  list-categories RETAILER  List available categories for retailer"
    echo "  test-redis                Test Redis connection"
    echo "  test-supabase             Test Supabase connection"
    echo "  help                      Show this help message"
    echo ""
    echo "Options (passed through to crawl.py):"
    echo "  --category CATEGORY           Specific category to crawl"
    echo "  --department DEPARTMENT       Specific department to crawl"
    echo "  --max-pages N                 Maximum pages per category (default: 5)"
    echo "  --crawler-concurrency N       Number of concurrent web scrapers (default: 1)"
    echo "  --upc-concurrency N           Number of concurrent UPC workers (default: 4)"
    echo "  --concurrency N               [DEPRECATED] Sets both crawler and UPC concurrency"
    echo "  --output PREFIX               Output file prefix"
    echo "  --log-level LEVEL             Logging level (DEBUG, INFO, WARNING, ERROR)"
    echo "  --backend BACKEND             Backend: json, redis, supabase (default: json)"
    echo "  --enable-upc-lookup           Enable UPC lookup (default for supabase)"
    echo "  --disable-upc-lookup          Disable UPC lookup"
    echo ""
    echo "Examples:"
    echo "  $0 quick-amazon --crawler-concurrency 8 --upc-concurrency 6"
    echo "  $0 supabase-amazon --crawler-concurrency 4 --upc-concurrency 6 --max-pages 15"
    echo "  $0 from-hierarchy-walmart --category \"Beverages\" --max-pages 10"
    echo "  $0 urls-target --category \"Beverages\""
    echo "  $0 hierarchy-amazon --max-pages 3 --output my_crawl"
    echo "  $0 list-categories amazon"
    echo "  $0 list-categories walmart"
    echo ""
    echo "Production Commands (Supabase):"
    echo "  # Full production crawl with optimized settings"
    echo "  $0 supabase-amazon --max-pages 15 --crawler-concurrency 4 --upc-concurrency 6"
    echo "  $0 supabase-target --max-pages 15 --crawler-concurrency 1 --upc-concurrency 6"
    echo "  $0 supabase-walmart --max-pages 15 --crawler-concurrency 1 --upc-concurrency 4"
    echo ""
    echo "Direct crawl.py usage:"
    echo "  $0 -- --retailer amazon --mode full --hierarchical --category \"Electronics\""
}

# check if Python script exists
if [[ ! -f "$CRAWL_SCRIPT" ]]; then
    print_error "crawl.py not found at $CRAWL_SCRIPT"
    exit 1
fi

# check if python is available
if ! command -v python &> /dev/null; then
    print_error "Python is not installed or not in PATH"
    exit 1
fi

# if no arguments, show usage
if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

# remove command from arguments
COMMAND="$1"
shift

case "$COMMAND" in
    quick-amazon)
        run_crawler "Starting quick Amazon crawl (full mode, 5 pages per category)" \
                   "Amazon crawl completed" \
                   --retailer amazon --mode full --max-pages 5 "$@"
        ;;
    
    quick-target)
        run_crawler "Starting quick Target crawl (full mode, 5 pages per category)" \
                   "Target crawl completed" \
                   --retailer target --mode full --max-pages 5 "$@"
        ;;
    
    quick-walmart)
        run_crawler "Starting quick Walmart crawl (full mode, 5 pages per category)" \
                   "Walmart crawl completed" \
                   --retailer walmart --mode full --max-pages 5 "$@"
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
    
    urls-walmart)
        print_info "Starting Walmart URL-only crawl to Redis"
        python "$CRAWL_SCRIPT" --retailer walmart --mode urls-only "$@"
        print_success "Walmart URL crawl completed"
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
    
    hierarchy-walmart)
        print_info "Starting Walmart hierarchical crawl (full mode)"
        python "$CRAWL_SCRIPT" --retailer walmart --mode full --hierarchical "$@"
        print_success "Walmart hierarchical crawl completed"
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
    
    hierarchy-urls-walmart)
        print_info "Starting Walmart hierarchical URL crawl"
        python "$CRAWL_SCRIPT" --retailer walmart --mode urls-only --hierarchical "$@"
        print_success "Walmart hierarchical URL crawl completed"
        ;;
    
    from-hierarchy-amazon)
        print_info "Starting Amazon crawl from hierarchy file (full mode)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer amazon --mode full --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer amazon --mode full --from-hierarchy-file "" "$@"
        fi
        print_success "Amazon hierarchy file crawl completed"
        ;;
    
    from-hierarchy-target)
        print_info "Starting Target crawl from hierarchy file (full mode)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer target --mode full --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer target --mode full --from-hierarchy-file "" "$@"
        fi
        print_success "Target hierarchy file crawl completed"
        ;;
    
    from-hierarchy-walmart)
        print_info "Starting Walmart crawl from hierarchy file (full mode)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer walmart --mode full --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer walmart --mode full --from-hierarchy-file "" "$@"
        fi
        print_success "Walmart hierarchy file crawl completed"
        ;;
    
    from-hierarchy-urls-amazon)
        print_info "Starting Amazon crawl from hierarchy file (URLs only)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer amazon --mode urls-only --from-hierarchy-file "" "$@"
        fi
        print_success "Amazon hierarchy file URL crawl completed"
        ;;
    
    from-hierarchy-urls-target)
        print_info "Starting Target crawl from hierarchy file (URLs only)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer target --mode urls-only --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer target --mode urls-only --from-hierarchy-file "" "$@"
        fi
        print_success "Target hierarchy file URL crawl completed"
        ;;
    
    from-hierarchy-urls-walmart)
        print_info "Starting Walmart crawl from hierarchy file (URLs only)"
        if [[ $# -gt 0 && ! $1 =~ ^-- ]]; then
            # first argument is likely a file path
            HIERARCHY_FILE="$1"
            shift
            python "$CRAWL_SCRIPT" --retailer walmart --mode urls-only --from-hierarchy-file "$HIERARCHY_FILE" "$@"
        else
            # use default hierarchy file
            python "$CRAWL_SCRIPT" --retailer walmart --mode urls-only --from-hierarchy-file "" "$@"
        fi
        print_success "Walmart hierarchy file URL crawl completed"
        ;;
    
    supabase-amazon)
        run_crawler "Starting Amazon full crawl to Supabase database" \
                   "Amazon full crawl to Supabase completed" \
                   --retailer amazon --mode full --backend supabase --from-hierarchy-file "" "$@"
        ;;
    
    supabase-target)
        run_crawler "Starting Target full crawl to Supabase database" \
                   "Target full crawl to Supabase completed" \
                   --retailer target --mode full --backend supabase --from-hierarchy-file "" "$@"
        ;;
    
    supabase-walmart)
        run_crawler "Starting Walmart full crawl to Supabase database" \
                   "Walmart full crawl to Supabase completed" \
                   --retailer walmart --mode full --backend supabase --from-hierarchy-file "" "$@"
        ;;
    
    list)
        python "$CRAWL_SCRIPT" --list-retailers
        ;;
    
    list-categories)
        if [[ $# -lt 1 ]]; then
            print_error "Missing retailer argument for list-categories command"
            echo "Usage: $0 list-categories <retailer>"
            echo "Available retailers: amazon, target, walmart"
            exit 1
        fi
        
        RETAILER="$1"
        if [[ "$RETAILER" != "amazon" && "$RETAILER" != "target" && "$RETAILER" != "walmart" ]]; then
            print_error "Invalid retailer '$RETAILER'. Available retailers: amazon, target, walmart"
            exit 1
        fi
        
        print_info "Listing categories for $RETAILER..."
        if python "$CRAWL_SCRIPT" --list-categories "$RETAILER"; then
            print_success "Category listing completed"
        else
            print_error "Failed to list categories for $RETAILER"
            exit 1
        fi
        ;;
    
    test-redis)
        print_info "Testing Redis connection..."
        python "$CRAWL_SCRIPT" --test-redis
        ;;
    
    test-supabase)
        print_info "Testing Supabase connection..."
        python "$CRAWL_SCRIPT" --test-supabase
        ;;
    
    help|--help|-h)
        show_usage
        ;;
    
    --)
        # pass through mode - run crawl.py directly with remaining arguments
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