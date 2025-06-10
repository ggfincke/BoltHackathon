import os
import sys
from pathlib import Path
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ConnectionPatch
import numpy as np
from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional
import re

@dataclass
class Column:
    name: str
    type: str
    is_primary_key: bool = False
    is_foreign_key: bool = False
    is_nullable: bool = True
    references: Optional[str] = None 

@dataclass
class Table:
    name: str
    columns: List[Column]
    position: Tuple[float, float] = (0, 0)

# parse schema files & extract table/relationship info
class DatabaseSchemaParser:
    
    def __init__(self):
        self.tables = {}
        self.relationships = []
    
    # parse all SQL migration files in the schema directory
    def parse_schema_files(self, schema_dir: str):
        schema_path = Path(schema_dir)
        
        # read all migration files in order
        migration_files = sorted([f for f in schema_path.glob("*.sql")])
        
        for file_path in migration_files:
            print(f"Parsing {file_path.name}...")
            with open(file_path, 'r') as f:
                content = f.read()
                self._parse_sql_content(content)
    
    # parse the SQL content to extract table definitions
    def _parse_sql_content(self, content: str):
        # remove comments & normalize whitespace
        content = re.sub(r'--.*?\n', '\n', content)
        content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
        
        # find CREATE TABLE statements
        table_pattern = r'CREATE TABLE\s+(\w+)\s*\((.*?)\);'
        matches = re.findall(table_pattern, content, re.DOTALL | re.IGNORECASE)
        
        for table_name, table_def in matches:
            if table_name not in self.tables:
                self.tables[table_name] = Table(table_name, [])
            
            self._parse_table_definition(table_name, table_def)
        
        # find ALTER TABLE statements for foreign keys
        alter_pattern = r'ALTER TABLE\s+(\w+)\s+ADD CONSTRAINT\s+\w+\s+FOREIGN KEY\s*\((\w+)\)\s+REFERENCES\s+(\w+)\s*\((\w+)\)'
        alter_matches = re.findall(alter_pattern, content, re.IGNORECASE)
        
        for table_name, fk_column, ref_table, ref_column in alter_matches:
            if table_name in self.tables:
                for col in self.tables[table_name].columns:
                    if col.name == fk_column:
                        col.is_foreign_key = True
                        col.references = f"{ref_table}.{ref_column}"
                        self.relationships.append((table_name, fk_column, ref_table, ref_column))
    
    # parse individual table definition
    def _parse_table_definition(self, table_name: str, table_def: str):
        lines = [line.strip() for line in table_def.split(',')]
        
        for line in lines:
            line = line.strip()
            if not line or line.upper().startswith('CONSTRAINT') or line.upper().startswith('UNIQUE'):
                continue
            
            # parse column definition
            col_match = re.match(r'(\w+)\s+([^,\s]+(?:\s*\([^)]+\))?)', line, re.IGNORECASE)
            if col_match:
                col_name = col_match.group(1)
                col_type = col_match.group(2)
                
                # check for constraints
                is_pk = 'PRIMARY KEY' in line.upper()
                is_nullable = 'NOT NULL' not in line.upper() and not is_pk
                is_fk = False
                references = None
                
                # check for inline foreign key references
                fk_match = re.search(r'REFERENCES\s+(\w+)\s*\((\w+)\)', line, re.IGNORECASE)
                if fk_match:
                    is_fk = True
                    references = f"{fk_match.group(1)}.{fk_match.group(2)}"
                    self.relationships.append((table_name, col_name, fk_match.group(1), fk_match.group(2)))
                
                column = Column(
                    name=col_name,
                    type=col_type,
                    is_primary_key=is_pk,
                    is_foreign_key=is_fk,
                    is_nullable=is_nullable,
                    references=references
                )
                
                self.tables[table_name].columns.append(column)

# generate schema diagram
class SchemaDiagramGenerator:
    
    def __init__(self, tables: Dict[str, Table], relationships: List[Tuple]):
        self.tables = tables
        self.relationships = relationships
        self.fig = None
        self.ax = None
        
        # visual settings
        self.table_width = 2.5
        self.table_header_height = 0.4
        self.row_height = 0.25
        self.margin = 0.5
        
        # colors
        self.colors = {
            'table_header': '#4A90E2',
            'table_body': '#F8F9FA',
            'primary_key': '#FFD700',
            'foreign_key': '#FF6B6B',
            'border': '#2C3E50',
            'text': '#2C3E50',
            'relationship': '#7F8C8D'
        }
    
    # calculate optimal positions for tables
    def calculate_layout(self):
        # group tables by relationships to create logical clusters
        table_names = list(self.tables.keys())
        n_tables = len(table_names)
        
        # calculate grid dimensions
        cols = int(np.ceil(np.sqrt(n_tables)))
        rows = int(np.ceil(n_tables / cols))
        
        # position tables in a grid with some clustering logic
        positions = {}
        
        # core tables (users, products, listings) get central positions
        core_tables = ['users', 'products', 'listings', 'retailers', 'brands', 'categories']
        secondary_tables = ['subscriptions', 'notifications', 'baskets', 'locations']
        
        # position core tables first
        core_positions = [
            (1, 3), (3, 3), (5, 3),  # users, products, listings
            (1, 1), (3, 1), (5, 1)   # retailers, brands, categories
        ]
        
        for i, table in enumerate(core_tables):
            if table in table_names and i < len(core_positions):
                positions[table] = core_positions[i]
        
        # position secondary tables
        secondary_positions = [
            (0, 2), (2, 4), (4, 4), (6, 2)
        ]
        
        sec_idx = 0
        for table in secondary_tables:
            if table in table_names and table not in positions and sec_idx < len(secondary_positions):
                positions[table] = secondary_positions[sec_idx]
                sec_idx += 1
        
        # position remaining tables
        remaining_positions = [
            (0, 0), (2, 0), (4, 0), (6, 0),
            (0, 4), (2, 2), (4, 2), (6, 4),
            (1, 5), (3, 5), (5, 5)
        ]
        
        rem_idx = 0
        for table_name in table_names:
            if table_name not in positions and rem_idx < len(remaining_positions):
                positions[table_name] = remaining_positions[rem_idx]
                rem_idx += 1
        
        # convert to actual coordinates
        for table_name, (col, row) in positions.items():
            x = col * (self.table_width + self.margin)
            y = row * (max([len(t.columns) for t in self.tables.values()]) * self.row_height + 1)
            self.tables[table_name].position = (x, y)
    
    # draw a single table
    def draw_table(self, table: Table):
        x, y = table.position
        
        # calculate table height
        table_height = self.table_header_height + len(table.columns) * self.row_height
        
        # draw table border
        table_rect = FancyBboxPatch(
            (x, y), self.table_width, table_height,
            boxstyle="round,pad=0.02",
            facecolor=self.colors['table_body'],
            edgecolor=self.colors['border'],
            linewidth=1.5
        )
        self.ax.add_patch(table_rect)
        
        # draw header
        header_rect = FancyBboxPatch(
            (x, y + table_height - self.table_header_height), 
            self.table_width, self.table_header_height,
            boxstyle="round,pad=0.02",
            facecolor=self.colors['table_header'],
            edgecolor=self.colors['border'],
            linewidth=1.5
        )
        self.ax.add_patch(header_rect)
        
        # table name
        self.ax.text(
            x + self.table_width/2, 
            y + table_height - self.table_header_height/2,
            table.name,
            ha='center', va='center',
            fontsize=10, fontweight='bold',
            color='white'
        )
        
        # draw columns
        for i, column in enumerate(table.columns):
            col_y = y + table_height - self.table_header_height - (i + 1) * self.row_height
            
            # column background color based on type
            if column.is_primary_key:
                col_color = self.colors['primary_key']
            elif column.is_foreign_key:
                col_color = self.colors['foreign_key']
            else:
                col_color = self.colors['table_body']
            
            # column rectangle
            if column.is_primary_key or column.is_foreign_key:
                col_rect = patches.Rectangle(
                    (x + 0.05, col_y + 0.02), 
                    self.table_width - 0.1, self.row_height - 0.04,
                    facecolor=col_color, alpha=0.3
                )
                self.ax.add_patch(col_rect)
            
            # column text
            col_text = column.name
            if column.is_primary_key:
                col_text = f"🔑 {col_text}"
            elif column.is_foreign_key:
                col_text = f"🔗 {col_text}"
            
            self.ax.text(
                x + 0.1, col_y + self.row_height/2,
                col_text,
                ha='left', va='center',
                fontsize=8,
                color=self.colors['text']
            )
            
            # column type
            self.ax.text(
                x + self.table_width - 0.1, col_y + self.row_height/2,
                column.type.split('(')[0].upper(),
                ha='right', va='center',
                fontsize=7,
                color=self.colors['text'],
                alpha=0.7
            )
    
    # draw relationship lines between tables
    def draw_relationships(self):
        for source_table, source_col, target_table, target_col in self.relationships:
            if source_table not in self.tables or target_table not in self.tables:
                continue
            
            source_pos = self.tables[source_table].position
            target_pos = self.tables[target_table].position
            
            # find column positions
            source_col_idx = next((i for i, col in enumerate(self.tables[source_table].columns) 
                                 if col.name == source_col), 0)
            target_col_idx = next((i for i, col in enumerate(self.tables[target_table].columns) 
                                 if col.name == target_col), 0)
            
            # calculate connection points
            source_x = source_pos[0] + self.table_width
            source_y = (source_pos[1] + 
                       max([len(t.columns) for t in self.tables.values()]) * self.row_height + 1 - 
                       self.table_header_height - (source_col_idx + 0.5) * self.row_height)
            
            target_x = target_pos[0]
            target_y = (target_pos[1] + 
                       max([len(t.columns) for t in self.tables.values()]) * self.row_height + 1 - 
                       self.table_header_height - (target_col_idx + 0.5) * self.row_height)
            
            # draw connection line
            connection = ConnectionPatch(
                (source_x, source_y), (target_x, target_y),
                "data", "data",
                arrowstyle="->",
                shrinkA=5, shrinkB=5,
                mutation_scale=15,
                fc=self.colors['relationship'],
                ec=self.colors['relationship'],
                alpha=0.6,
                linewidth=1
            )
            self.ax.add_patch(connection)
    
    # generate complete schema diagram
    def generate_diagram(self, output_path: str = "database_schema.png"):
        # calculate layout
        self.calculate_layout()
        
        # calculate figure size
        max_x = max([pos[0] + self.table_width for pos in 
                    [table.position for table in self.tables.values()]])
        max_y = max([pos[1] + len(table.columns) * self.row_height + 1 for pos, table in 
                    [(table.position, table) for table in self.tables.values()]])
        
        # create figure
        fig_width = max(12, max_x / 72 * 100)
        fig_height = max(8, max_y / 72 * 100)
        
        self.fig, self.ax = plt.subplots(figsize=(fig_width, fig_height))
        self.ax.set_xlim(-0.5, max_x + 0.5)
        self.ax.set_ylim(-0.5, max_y + 0.5)
        self.ax.set_aspect('equal')
        self.ax.axis('off')
        
        # set background color
        self.fig.patch.set_facecolor('white')
        
        # draw all tables
        for table in self.tables.values():
            self.draw_table(table)
        
        # draw relationships
        self.draw_relationships()
        
        # add title
        self.fig.suptitle('Database Schema - Supabase ERD', 
                         fontsize=16, fontweight='bold', y=0.95)
        
        # add legend
        legend_elements = [
            patches.Patch(color=self.colors['primary_key'], alpha=0.3, label='Primary Key'),
            patches.Patch(color=self.colors['foreign_key'], alpha=0.3, label='Foreign Key'),
            patches.Patch(color=self.colors['relationship'], alpha=0.6, label='Relationship')
        ]
        self.ax.legend(handles=legend_elements, loc='upper right', bbox_to_anchor=(0.98, 0.98))
        
        # save diagram
        plt.tight_layout()
        plt.savefig(output_path, dpi=300, bbox_inches='tight', 
                   facecolor='white', edgecolor='none')
        print(f"Schema diagram saved to: {output_path}")
        
        return output_path

# main  
def main():
    # get script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    
    # parse schema
    parser = DatabaseSchemaParser()
    schema_dir = project_root / "supabase" / "migrations"
    
    if not schema_dir.exists():
        print(f"Error: Schema directory not found: {schema_dir}")
        sys.exit(1)
    
    print("Parsing database schema...")
    parser.parse_schema_files(str(schema_dir))
    
    print(f"Found {len(parser.tables)} tables:")
    for table_name in parser.tables.keys():
        print(f"  - {table_name}")
    
    print(f"Found {len(parser.relationships)} relationships")
    
    # generate diagram
    generator = SchemaDiagramGenerator(parser.tables, parser.relationships)
    docs_dir = project_root / "docs"
    docs_dir.mkdir(exist_ok=True) 
    output_path = docs_dir / "database_schema.png"
    
    print("Generating schema diagram...")
    generator.generate_diagram(str(output_path))
    
    print("Done!")

if __name__ == "__main__":
    main() 