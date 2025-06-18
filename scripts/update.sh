#!/bin/bash

# Update Script Wrapper
# Convenient wrapper around the Python update script for common update operations

set -euo pipefail

# ANSI color codes for pretty output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UPDATE_SCRIPT="$SCRIPT_DIR/update.py"

# Helper functions
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

print_header() {
    echo -e "${PURPLE}=================================${NC}"
    echo -e "${PURPLE}🔄 Product Update Manager${NC}"
    echo -e "${PURPLE}=================================${NC}"
}

show_usage() {
    print_header
    echo ""
    echo "Usage: $0 COMMAND [OPTIONS]"
    echo ""
    echo "Quick Commands:"
    echo "  quick-amazon              Update 50 Amazon products (recent)"
    echo "  quick-target              Update 50 Target products (recent)"
    echo "  quick-walmart             Update 50 Walmart products (recent)"
    echo "  quick-all                 Update 25 products from each retailer"
    echo ""
    echo "Priority Commands:"
    echo "  priority-amazon           Update high-priority Amazon products"
    echo "  priority-target           Update high-priority Target products"
    echo "  priority-walmart          Update high-priority Walmart products"
    echo "  priority-all              Update priority products from all retailers"
    echo ""
    echo "Stale Update Commands:"
    echo "  stale-amazon              Update Amazon products not updated in 3+ days"
    echo "  stale-target              Update Target products not updated in 3+ days"
    echo "  stale-walmart             Update Walmart products not updated in 3+ days"
    echo "  stale-all                 Update stale products from all retailers"
    echo ""
    echo "Category Commands:"
    echo "  category-amazon CAT       Update Amazon products in specific category"
    echo "  category-target CAT       Update Target products in specific category"
    echo "  category-walmart CAT      Update Walmart products in specific category"
    echo ""
    echo "Brand Commands:"
    echo "  brand-amazon BRAND        Update Amazon products from specific brand"
    echo "  brand-target BRAND        Update Target products from specific brand"
    echo "  brand-walmart BRAND       Update Walmart products from specific brand"
    echo ""
    echo "Utility Commands:"
    echo "  status                    Show update statistics and recent activity"
    echo "  dry-run RETAILER          Preview what would be updated"
    echo "  help                      Show this help message"
    echo ""
    echo "Options:"
    echo "  --max-products N          Maximum products to update (default varies by command)"
    echo "  --scraper-concurrency N   Number of concurrent scrapers (default: 5)"
    echo "  --days-since-update N     Only update products older than N days"
    echo "  --log-level LEVEL         Logging level (DEBUG, INFO, WARNING, ERROR)"
    echo ""
    echo "Examples:"
    echo "  $0 quick-amazon --max-products 100 --scraper-concurrency 8"
    echo "  $0 priority-all --max-products 50"
    echo "  $0 category-target \"Beverages\" --max-products 25"
    echo "  $0 stale-all --days-since-update 7 --max-products 200"
    echo "  $0 dry-run amazon --max-products 10"
    echo ""
    echo "Direct update.py usage:"
    echo "  $0 -- --retailer amazon --category \"Electronics\" --max-products 50"
}

# Check if Python script exists
if [[ ! -f "$UPDATE_SCRIPT" ]]; then
    print_error "update.py not found at $UPDATE_SCRIPT"
    exit 1
fi

# If no arguments, show usage
if [[ $# -eq 0 ]]; then
    show_usage
    exit 0
fi

# Remove command from arguments
COMMAND="$1"
shift

case "$COMMAND" in
    quick-amazon)
        print_info "Quick Amazon update (50 recent products)"
        python "$UPDATE_SCRIPT" --retailer amazon --max-products 50 --priority-only "$@"
        print_success "Amazon quick update completed"
        ;;
    
    quick-target)
        print_info "Quick Target update (50 recent products)"
        python "$UPDATE_SCRIPT" --retailer target --max-products 50 --priority-only "$@"
        print_success "Target quick update completed"
        ;;
    
    quick-walmart)
        print_info "Quick Walmart update (50 recent products)"
        python "$UPDATE_SCRIPT" --retailer walmart --max-products 50 --priority-only "$@"
        print_success "Walmart quick update completed"
        ;;
    
    quick-all)
        print_info "Quick update for all retailers (25 products each)"
        python "$UPDATE_SCRIPT" --all-retailers --max-products 25 --priority-only "$@"
        print_success "Quick update for all retailers completed"
        ;;
    
    priority-amazon)
        print_info "Updating high-priority Amazon products"
        python "$UPDATE_SCRIPT" --retailer amazon --priority-only --max-products 100 "$@"
        print_success "Amazon priority update completed"
        ;;
    
    priority-target)
        print_info "Updating high-priority Target products"
        python "$UPDATE_SCRIPT" --retailer target --priority-only --max-products 100 "$@"
        print_success "Target priority update completed"
        ;;
    
    priority-walmart)
        print_info "Updating high-priority Walmart products"
        python "$UPDATE_SCRIPT" --retailer walmart --priority-only --max-products 100 "$@"
        print_success "Walmart priority update completed"
        ;;
    
    priority-all)
        print_info "Updating high-priority products from all retailers"
        python "$UPDATE_SCRIPT" --all-retailers --priority-only --max-products 50 "$@"
        print_success "Priority update for all retailers completed"
        ;;
    
    stale-amazon)
        print_info "Updating stale Amazon products (3+ days old)"
        python "$UPDATE_SCRIPT" --retailer amazon --stale-only --days-since-update 3 --max-products 200 "$@"
        print_success "Amazon stale update completed"
        ;;
    
    stale-target)
        print_info "Updating stale Target products (3+ days old)"
        python "$UPDATE_SCRIPT" --retailer target --stale-only --days-since-update 3 --max-products 200 "$@"
        print_success "Target stale update completed"
        ;;
    
    stale-walmart)
        print_info "Updating stale Walmart products (3+ days old)"
        python "$UPDATE_SCRIPT" --retailer walmart --stale-only --days-since-update 3 --max-products 200 "$@"
        print_success "Walmart stale update completed"
        ;;
    
    stale-all)
        print_info "Updating stale products from all retailers (3+ days old)"
        python "$UPDATE_SCRIPT" --all-retailers --stale-only --days-since-update 3 --max-products 100 "$@"
        print_success "Stale update for all retailers completed"
        ;;
    
    category-amazon)
        if [[ $# -lt 1 ]]; then
            print_error "Category name required for category-amazon command"
            echo "Usage: $0 category-amazon \"Category Name\" [options]"
            exit 1
        fi
        CATEGORY="$1"
        shift
        print_info "Updating Amazon products in category: $CATEGORY"
        python "$UPDATE_SCRIPT" --retailer amazon --category "$CATEGORY" --max-products 75 "$@"
        print_success "Amazon category update completed"
        ;;
    
    category-target)
        if [[ $# -lt 1 ]]; then
            print_error "Category name required for category-target command"
            echo "Usage: $0 category-target \"Category Name\" [options]"
            exit 1
        fi
        CATEGORY="$1"
        shift
        print_info "Updating Target products in category: $CATEGORY"
        python "$UPDATE_SCRIPT" --retailer target --category "$CATEGORY" --max-products 75 "$@"
        print_success "Target category update completed"
        ;;
    
    category-walmart)
        if [[ $# -lt 1 ]]; then
            print_error "Category name required for category-walmart command"
            echo "Usage: $0 category-walmart \"Category Name\" [options]"
            exit 1
        fi
        CATEGORY="$1"
        shift
        print_info "Updating Walmart products in category: $CATEGORY"
        python "$UPDATE_SCRIPT" --retailer walmart --category "$CATEGORY" --max-products 75 "$@"
        print_success "Walmart category update completed"
        ;;
    
    brand-amazon)
        if [[ $# -lt 1 ]]; then
            print_error "Brand name required for brand-amazon command"
            echo "Usage: $0 brand-amazon \"Brand Name\" [options]"
            exit 1
        fi
        BRAND="$1"
        shift
        print_info "Updating Amazon products from brand: $BRAND"
        python "$UPDATE_SCRIPT" --retailer amazon --brand "$BRAND" --max-products 75 "$@"
        print_success "Amazon brand update completed"
        ;;
    
    brand-target)
        if [[ $# -lt 1 ]]; then
            print_error "Brand name required for brand-target command"
            echo "Usage: $0 brand-target \"Brand Name\" [options]"
            exit 1
        fi
        BRAND="$1"
        shift
        print_info "Updating Target products from brand: $BRAND"
        python "$UPDATE_SCRIPT" --retailer target --brand "$BRAND" --max-products 75 "$@"
        print_success "Target brand update completed"
        ;;
    
    brand-walmart)
        if [[ $# -lt 1 ]]; then
            print_error "Brand name required for brand-walmart command"
            echo "Usage: $0 brand-walmart \"Brand Name\" [options]"
            exit 1
        fi
        BRAND="$1"
        shift
        print_info "Updating Walmart products from brand: $BRAND"
        python "$UPDATE_SCRIPT" --retailer walmart --brand "$BRAND" --max-products 75 "$@"
        print_success "Walmart brand update completed"
        ;;
    
    dry-run)
        if [[ $# -lt 1 ]]; then
            print_error "Retailer required for dry-run command"
            echo "Usage: $0 dry-run RETAILER [options]"
            exit 1
        fi
        RETAILER="$1"
        shift
        print_info "Dry run for $RETAILER (preview mode)"
        python "$UPDATE_SCRIPT" --retailer "$RETAILER" --dry-run --max-products 10 "$@"
        print_success "Dry run completed"
        ;;
    
    status)
        print_info "Checking update status and recent activity"
        print_warning "Status command not yet implemented"
        print_info "Suggestion: Check Supabase dashboard for recent price_histories entries"
        ;;
    
    help|--help|-h)
        show_usage
        ;;
    
    --)
        # Pass all remaining arguments directly to update.py
        print_info "Running update.py with custom arguments"
        python "$UPDATE_SCRIPT" "$@"
        print_success "Custom update completed"
        ;;
    
    *)
        print_error "Unknown command: $COMMAND"
        echo ""
        show_usage
        exit 1
        ;;
esac