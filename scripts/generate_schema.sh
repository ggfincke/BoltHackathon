#!/bin/bash

# Database Schema Diagram Generator
# This script generates a visual database schema diagram from Supabase database schema

echo "🗄️  Database Schema Diagram Generator"
echo "======================================"

# Check if Python is available
if ! command -v python &> /dev/null; then
    echo "❌ Error: Python is not installed or not in PATH"
    exit 1
fi

# Check if required Python packages are installed
python -c "import matplotlib, numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "📦 Installing required dependencies..."
    pip install matplotlib numpy
fi

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "📊 Generating database schema diagram..."
python "$SCRIPT_DIR/generate_schema_diagram.py"

if [ $? -eq 0 ]; then
    echo "✅ Schema diagram generated successfully!"
    echo "📁 Output: $PROJECT_ROOT/database_schema.png"
    
    # Try to open the image if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "🖼️  Opening diagram..."
        open "$PROJECT_ROOT/database_schema.png"
    fi
else
    echo "❌ Error generating schema diagram"
    exit 1
fi 