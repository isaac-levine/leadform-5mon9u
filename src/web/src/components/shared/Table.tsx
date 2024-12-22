import React, { memo, useState, useCallback, useEffect, useRef } from 'react';
import clsx from 'clsx'; // ^2.0.0
import { Button } from './Button';
import { formatDate } from '../../lib/utils/formatting';

// Enhanced table column interface with comprehensive configuration options
export interface TableColumn {
  /** Unique identifier for the column */
  id: string;
  /** Display text for column header */
  header: string;
  /** Data accessor - either string key or function */
  accessor: string | ((row: any) => any);
  /** Enable/disable sorting for this column */
  sortable?: boolean;
  /** Column width (e.g., '200px', '25%') */
  width?: string;
  /** Custom cell renderer */
  cell?: (value: any, row: any) => React.ReactNode;
  /** Custom className for cells */
  cellClassName?: string;
  /** Custom className for header */
  headerClassName?: string;
  /** Transform function for sorting */
  sortTransform?: (value: any) => any;
  /** Filter options for the column */
  filterOptions?: { value: string; label: string }[];
  /** Enable/disable column resizing */
  resizable?: boolean;
}

// Enhanced table props interface with comprehensive features
export interface TableProps {
  /** Column definitions */
  columns: TableColumn[];
  /** Table data */
  data: any[];
  /** Enable sorting */
  sortable?: boolean;
  /** Enable pagination */
  pagination?: boolean;
  /** Items per page */
  pageSize?: number;
  /** Sort callback */
  onSort?: (columnId: string, direction: 'asc' | 'desc') => void;
  /** Page change callback */
  onPageChange?: (page: number) => void;
  /** Loading state */
  loading?: boolean;
  /** Custom className */
  className?: string;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Enable row selection */
  selectable?: boolean;
  /** Row selection callback */
  onRowSelect?: (selectedRows: any[]) => void;
  /** Row click callback */
  onRowClick?: (row: any) => void;
  /** Custom empty state content */
  emptyState?: React.ReactNode;
  /** Custom loading state content */
  loadingState?: React.ReactNode;
  /** Enable virtualization for large datasets */
  virtualized?: boolean;
}

// Utility function to generate table classes with proper styling
const getTableClasses = (
  className?: string,
  stickyHeader?: boolean,
  virtualized?: boolean
): string => {
  return clsx(
    'w-full border-collapse',
    'bg-white dark:bg-neutral-900',
    'text-sm text-neutral-900 dark:text-neutral-100',
    stickyHeader && 'relative',
    virtualized && 'virtual-table',
    className
  );
};

// Custom hook for table virtualization
const useVirtualization = (data: any[], pageSize: number, rowHeight: number) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: pageSize });

  const updateVisibleRange = useCallback(() => {
    if (!containerRef.current) return;

    const { scrollTop, clientHeight } = containerRef.current;
    const start = Math.floor(scrollTop / rowHeight);
    const end = Math.min(
      start + Math.ceil(clientHeight / rowHeight),
      data.length
    );

    setVisibleRange({ start, end });
  }, [data.length, rowHeight]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', updateVisibleRange);
    return () => container.removeEventListener('scroll', updateVisibleRange);
  }, [updateVisibleRange]);

  return {
    containerRef,
    visibleRange,
    totalHeight: data.length * rowHeight,
    rowHeight
  };
};

/**
 * Enhanced table component implementing the design system's table styles and behaviors.
 * Supports sorting, pagination, responsive display, and enhanced features like row selection
 * and sticky headers while ensuring accessibility compliance.
 */
export const Table = memo<TableProps>(({
  columns,
  data,
  sortable = false,
  pagination = false,
  pageSize = 10,
  onSort,
  onPageChange,
  loading = false,
  className,
  stickyHeader = false,
  selectable = false,
  onRowSelect,
  onRowClick,
  emptyState,
  loadingState,
  virtualized = false
}) => {
  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{ columnId: string; direction: 'asc' | 'desc' } | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<any>>(new Set());

  // Virtualization setup
  const virtualizationConfig = virtualized
    ? useVirtualization(data, pageSize, 48) // 48px default row height
    : null;

  // Sort handler with support for custom transforms
  const handleSort = useCallback((columnId: string) => {
    if (!sortable) return;

    const column = columns.find(col => col.id === columnId);
    const newDirection = sortConfig?.columnId === columnId && sortConfig.direction === 'asc'
      ? 'desc'
      : 'asc';

    setSortConfig({ columnId, direction: newDirection });
    onSort?.(columnId, newDirection);
  }, [sortable, columns, sortConfig, onSort]);

  // Row selection handler
  const handleRowSelect = useCallback((row: any) => {
    if (!selectable) return;

    setSelectedRows(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(row)) {
        newSelected.delete(row);
      } else {
        newSelected.add(row);
      }
      onRowSelect?.(Array.from(newSelected));
      return newSelected;
    });
  }, [selectable, onRowSelect]);

  // Pagination handlers
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    onPageChange?.(newPage);
  }, [onPageChange]);

  // Calculate visible data
  const visibleData = React.useMemo(() => {
    if (virtualized) {
      const { start, end } = virtualizationConfig!.visibleRange;
      return data.slice(start, end);
    }
    
    if (pagination) {
      const start = (currentPage - 1) * pageSize;
      return data.slice(start, start + pageSize);
    }
    
    return data;
  }, [data, pagination, currentPage, pageSize, virtualized, virtualizationConfig]);

  // Render table header
  const renderHeader = () => (
    <thead className={clsx(
      'bg-neutral-50 dark:bg-neutral-800',
      stickyHeader && 'sticky top-0 z-10'
    )}>
      <tr>
        {selectable && (
          <th className="w-8 p-3">
            <input
              type="checkbox"
              onChange={() => {
                const newSelected = selectedRows.size === data.length
                  ? new Set()
                  : new Set(data);
                setSelectedRows(newSelected);
                onRowSelect?.(Array.from(newSelected));
              }}
              checked={selectedRows.size === data.length}
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.map(column => (
          <th
            key={column.id}
            className={clsx(
              'p-3 text-left font-medium',
              column.sortable && 'cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-700',
              column.headerClassName
            )}
            style={{ width: column.width }}
            onClick={() => column.sortable && handleSort(column.id)}
            aria-sort={sortConfig?.columnId === column.id
              ? sortConfig.direction
              : undefined}
          >
            <div className="flex items-center gap-2">
              {column.header}
              {column.sortable && sortConfig?.columnId === column.id && (
                <span className="text-neutral-500">
                  {sortConfig.direction === 'asc' ? '↑' : '↓'}
                </span>
              )}
            </div>
          </th>
        ))}
      </tr>
    </thead>
  );

  // Render table body
  const renderBody = () => (
    <tbody>
      {visibleData.map((row, index) => (
        <tr
          key={index}
          className={clsx(
            'border-t border-neutral-200 dark:border-neutral-700',
            onRowClick && 'cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800',
            selectedRows.has(row) && 'bg-primary-50 dark:bg-primary-900/20'
          )}
          onClick={() => onRowClick?.(row)}
        >
          {selectable && (
            <td className="w-8 p-3">
              <input
                type="checkbox"
                checked={selectedRows.has(row)}
                onChange={() => handleRowSelect(row)}
                aria-label={`Select row ${index + 1}`}
              />
            </td>
          )}
          {columns.map(column => (
            <td
              key={column.id}
              className={clsx('p-3', column.cellClassName)}
            >
              {column.cell
                ? column.cell(
                    typeof column.accessor === 'function'
                      ? column.accessor(row)
                      : row[column.accessor],
                    row
                  )
                : formatCellValue(
                    typeof column.accessor === 'function'
                      ? column.accessor(row)
                      : row[column.accessor]
                  )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );

  // Utility function to format cell values
  const formatCellValue = (value: any): React.ReactNode => {
    if (value instanceof Date) {
      return formatDate(value);
    }
    if (value === null || value === undefined) {
      return '—';
    }
    return String(value);
  };

  // Render pagination controls
  const renderPagination = () => {
    if (!pagination) return null;

    const totalPages = Math.ceil(data.length / pageSize);
    return (
      <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 dark:border-neutral-700">
        <div className="text-sm text-neutral-700 dark:text-neutral-300">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, data.length)} of {data.length} entries
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            Next
          </Button>
        </div>
      </div>
    );
  };

  // Render empty state
  if (data.length === 0 && !loading) {
    return (
      <div className="text-center p-8 bg-white dark:bg-neutral-900 rounded-md">
        {emptyState || (
          <div className="text-neutral-500 dark:text-neutral-400">
            No data available
          </div>
        )}
      </div>
    );
  }

  // Render loading state
  if (loading) {
    return (
      <div className="text-center p-8 bg-white dark:bg-neutral-900 rounded-md">
        {loadingState || (
          <div className="text-neutral-500 dark:text-neutral-400">
            Loading...
          </div>
        )}
      </div>
    );
  }

  // Main table render
  return (
    <div className="overflow-x-auto">
      <div
        ref={virtualizationConfig?.containerRef}
        style={virtualized ? {
          height: '400px',
          overflow: 'auto'
        } : undefined}
      >
        <table
          className={getTableClasses(className, stickyHeader, virtualized)}
          role="grid"
          aria-busy={loading}
          aria-colcount={columns.length}
          aria-rowcount={data.length}
        >
          {renderHeader()}
          {renderBody()}
        </table>
        {renderPagination()}
      </div>
    </div>
  );
});

Table.displayName = 'Table';

export default Table;