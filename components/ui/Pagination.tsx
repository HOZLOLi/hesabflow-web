import React from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  itemsPerPage: number;
  totalItems: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage,
  totalItems
}) => {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800">
      <div className="text-xs text-gray-600 dark:text-neutral-400">
        نمایش {startItem.toLocaleString('fa-IR')} تا {endItem.toLocaleString('fa-IR')} از {totalItems.toLocaleString('fa-IR')} مورد
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-1.5 border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
        >
          <ChevronRight size={16} />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
            // نمایش صفحات: اول، آخر، فعلی و 2 صفحه اطراف
            if (
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1)
            ) {
              return (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  className={`min-w-[32px] h-8 px-2 text-xs font-bold transition-colors ${
                    page === currentPage
                      ? 'bg-primary dark:bg-white text-white dark:text-black'
                      : 'border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {page.toLocaleString('fa-IR')}
                </button>
              );
            } else if (
              page === currentPage - 2 ||
              page === currentPage + 2
            ) {
              return <span key={page} className="text-gray-400 px-1">...</span>;
            }
            return null;
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-1.5 border border-gray-300 dark:border-neutral-700 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
        >
          <ChevronLeft size={16} />
        </button>
      </div>
    </div>
  );
};
