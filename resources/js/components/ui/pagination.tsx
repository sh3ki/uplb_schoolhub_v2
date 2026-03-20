import { router } from '@inertiajs/react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PaginationLink {
    url: string | null;
    label: string;
    active: boolean;
}

interface PaginationData {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number;
    to: number;
    links: PaginationLink[];
}

interface PaginationProps {
    data: PaginationData;
    preserveState?: boolean;
    preserveScroll?: boolean;
    onPageChange?: (page: number) => void;
}

export function Pagination({ data, preserveState = true, preserveScroll = true, onPageChange }: PaginationProps) {
    const handlePageChange = (url: string | null) => {
        if (onPageChange) {
            return;
        }

        if (!url) return;
        
        router.get(url, {}, {
            preserveState,
            preserveScroll,
        });
    };

    const goToPage = (page: number) => {
        if (page < 1 || page > data.last_page) return;

        if (onPageChange) {
            onPageChange(page);
            return;
        }

        const link = data.links.find((candidate) => parseInt(candidate.label) === page);
        if (link?.url) {
            handlePageChange(link.url);
        }
    };

    if (data.last_page <= 1) return null;

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t">
            {/* Results info */}
            <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{data.from}</span> to{' '}
                <span className="font-medium">{data.to}</span> of{' '}
                <span className="font-medium">{data.total}</span> results
            </div>

            {/* Pagination buttons */}
            <div className="flex items-center gap-2">
                {/* First page */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(1)}
                    disabled={data.current_page === 1}
                    className="h-8 w-8 p-0"
                >
                    <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous page */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(data.current_page - 1)}
                    disabled={data.current_page === 1}
                    className="h-8 w-8 p-0"
                >
                    <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1">
                    {data.links
                        .filter((link) => !isNaN(parseInt(link.label)))
                        .map((link, index) => {
                            const pageNumber = parseInt(link.label);
                            const currentPage = data.current_page;
                            
                            // Show first, last, current, and adjacent pages
                            if (
                                pageNumber === 1 ||
                                pageNumber === data.last_page ||
                                (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1)
                            ) {
                                return (
                                    <Button
                                        key={index}
                                        size="sm"
                                        variant={link.active ? 'default' : 'outline'}
                                        onClick={() => goToPage(pageNumber)}
                                        className="h-8 w-8 p-0"
                                    >
                                        {link.label}
                                    </Button>
                                );
                            } else if (
                                pageNumber === currentPage - 2 ||
                                pageNumber === currentPage + 2
                            ) {
                                return <span key={index} className="px-1">...</span>;
                            }
                            return null;
                        })}
                </div>

                {/* Next page */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(data.current_page + 1)}
                    disabled={data.current_page === data.last_page}
                    className="h-8 w-8 p-0"
                >
                    <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Last page */}
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToPage(data.last_page)}
                    disabled={data.current_page === data.last_page}
                    className="h-8 w-8 p-0"
                >
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
