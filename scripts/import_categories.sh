#!/bin/bash

# Category Management Shell Script
# Provides convenient wrappers for import_categories.py functionality

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PYTHON_SCRIPT="$SCRIPT_DIR/import_categories.py"

# Default values
LOG_LEVEL="INFO"
DRY_RUN=""

# Help function
show_help() {
    echo -e "${BLUE}Category Management Script${NC}"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo -e "${GREEN}Commands:${NC}"
    echo "  import                    Import categories from categories.json (default)"
    echo "  populate <retailer>       Populate categories from retailer hierarchy"
    echo "  check <category>          Check if specific category exists"
    echo "  debug <product> [retailer] [raw_category]  Debug category normalization"
    echo "  clear-and-import          Clear existing categories and import fresh"
    echo ""
    echo -e "${GREEN}Options:${NC}"
    echo "  --dry-run                 Show what would happen without making changes"
    echo "  --log-level LEVEL         Set logging level (DEBUG, INFO, WARNING, ERROR)"
    echo "  --categories-file FILE    Path to categories JSON file"
    echo "  --help                    Show this help message"
    echo ""
    echo -e "${GREEN}Examples:${NC}"
    echo "  $0 import                                    # Import from default categories.json"
    echo "  $0 import --dry-run                         # Dry run import"
    echo "  $0 populate amazon                          # Populate from Amazon hierarchy"
    echo "  $0 check \"Gummy Candies\"                   # Check if category exists"
    echo "  $0 debug \"JOLLY RANCHER Gummies\"           # Debug normalization"
    echo "  $0 debug \"Product Name\" walmart \"Candy\"   # Debug with specific retailer/category"
    echo "  $0 clear-and-import --categories-file custom.json  # Clear and import from custom file"
}

# Log functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python script exists
check_python_script() {
    if [[ ! -f "$PYTHON_SCRIPT" ]]; then
        log_error "Python script not found: $PYTHON_SCRIPT"
        exit 1
    fi
}

# Run Python script with arguments
run_python_script() {
    local args=("$@")
    
    # Add common options
    if [[ -n "$DRY_RUN" ]]; then
        args+=("--dry-run")
    fi
    
    if [[ -n "$LOG_LEVEL" ]]; then
        args+=("--log-level" "$LOG_LEVEL")
    fi
    
    log_info "Running: python $PYTHON_SCRIPT ${args[*]}"
    cd "$PROJECT_ROOT"
    python "$PYTHON_SCRIPT" "${args[@]}"
}

# Import categories from JSON
cmd_import() {
    local categories_file=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --categories-file)
                categories_file="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option for import: $1"
                exit 1
                ;;
        esac
    done
    
    local args=()
    if [[ -n "$categories_file" ]]; then
        args+=("--categories-file" "$categories_file")
    fi
    
    log_info "Importing categories from JSON..."
    run_python_script "${args[@]}"
}

# Populate from retailer hierarchy
cmd_populate() {
    if [[ $# -lt 1 ]]; then
        log_error "Retailer name required for populate command"
        echo "Usage: $0 populate <amazon|target|walmart>"
        exit 1
    fi
    
    local retailer="$1"
    
    case "$retailer" in
        amazon|target|walmart)
            log_info "Populating categories from $retailer hierarchy..."
            run_python_script "--populate-from-hierarchy" "$retailer"
            ;;
        *)
            log_error "Invalid retailer: $retailer. Use amazon, target, or walmart"
            exit 1
            ;;
    esac
}

# Check category existence
cmd_check() {
    if [[ $# -lt 1 ]]; then
        log_error "Category name required for check command"
        echo "Usage: $0 check \"<category name>\""
        exit 1
    fi
    
    local category="$1"
    
    log_info "Checking if category exists: $category"
    run_python_script "--check-category" "$category"
}

# Debug category normalization
cmd_debug() {
    if [[ $# -lt 1 ]]; then
        log_error "Product name required for debug command"
        echo "Usage: $0 debug \"<product name>\" [retailer] [raw_category]"
        exit 1
    fi
    
    local product="$1"
    local retailer="${2:-amazon}"
    local raw_category="${3:-Gummy Candies}"
    
    log_info "Debugging category normalization for: $product"
    log_info "Retailer: $retailer, Raw category: $raw_category"
    
    run_python_script "--debug-normalization" "$product" "--retailer" "$retailer" "--raw-category" "$raw_category"
}

# Clear existing and import fresh
cmd_clear_and_import() {
    local categories_file=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --categories-file)
                categories_file="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option for clear-and-import: $1"
                exit 1
                ;;
        esac
    done
    
    log_warn "This will DELETE ALL existing categories!"
    if [[ -z "$DRY_RUN" ]]; then
        read -p "Are you sure? Type 'yes' to continue: " -r
        if [[ ! $REPLY =~ ^yes$ ]]; then
            log_info "Operation cancelled"
            exit 0
        fi
    fi
    
    local args=("--clear-existing")
    if [[ -n "$categories_file" ]]; then
        args+=("--categories-file" "$categories_file")
    fi
    
    log_info "Clearing existing categories and importing fresh..."
    run_python_script "${args[@]}"
}

# Main function
main() {
    check_python_script
    
    # Parse global options first
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --log-level)
                LOG_LEVEL="$2"
                shift 2
                ;;
            --help)
                show_help
                exit 0
                ;;
            --*)
                # Keep other options for command-specific parsing
                break
                ;;
            *)
                # This is the command
                break
                ;;
        esac
    done
    
    # Default command is import if none specified
    local command="${1:-import}"
    
    case "$command" in
        import)
            shift
            cmd_import "$@"
            ;;
        populate)
            shift
            cmd_populate "$@"
            ;;
        check)
            shift
            cmd_check "$@"
            ;;
        debug)
            shift
            cmd_debug "$@"
            ;;
        clear-and-import)
            shift
            cmd_clear_and_import "$@"
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@" 