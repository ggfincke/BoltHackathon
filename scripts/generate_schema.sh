# Generates a visual database schema diagram from Supabase database schema

echo "🗄️  Database Schema Diagram Generator"
echo "======================================"

# Python availability check
if ! command -v python &> /dev/null; then
    echo "❌ Error: Python is not installed or not in PATH"
    exit 1
fi

# Python packages check
python -c "import matplotlib, numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing required dependencies..."
    pip install matplotlib numpy
fi

# Get script dir
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DOCS_DIR="$PROJECT_ROOT/docs"

# Create docs dir (if doesn't exist)
mkdir -p "$DOCS_DIR"

echo "📊 Generating database schema diagram..."
python "$SCRIPT_DIR/generate_schema_diagram.py"

if [ $? -eq 0 ]; then
    echo "✅ Schema diagram generated successfully!"
    echo "📁 Output: $DOCS_DIR/database_schema.png"
    
    # try to open image if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🖼️  Opening diagram..."
        open "$DOCS_DIR/database_schema.png"
    fi
else
    echo "❌ Error generating schema diagram"
    exit 1
fi 