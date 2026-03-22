import { Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PdfViewerProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    filePath: string;
    fileType?: string;
    fileName?: string;
}

export function PdfViewer({ open, onOpenChange, title, filePath }: PdfViewerProps) {
    const resolvedPath = filePath || '';
    const isAbsoluteUrl = /^https?:\/\//i.test(resolvedPath);
    const url = isAbsoluteUrl
        ? resolvedPath
        : (resolvedPath.startsWith('/storage/') ? resolvedPath : `/storage/${resolvedPath}`);

    const lowerUrl = url.toLowerCase();
    const isImage = /\.(jpg|jpeg|png|gif|webp)(\?|$)/.test(lowerUrl);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <div className="flex items-center justify-between">
                        <DialogTitle>{title}</DialogTitle>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" asChild>
                                <a href={url} download={title}>
                                    <Download className="mr-2 h-4 w-4" />
                                    Download
                                </a>
                            </Button>
                            <Button variant="outline" size="sm" asChild>
                                <a href={url} target="_blank" rel="noopener noreferrer">
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open in New Tab
                                </a>
                            </Button>
                        </div>
                    </div>
                </DialogHeader>
                <div className="flex-1 min-h-0">
                    {isImage ? (
                        <div className="h-full w-full rounded-lg border bg-muted/30 p-2">
                            <img
                                src={url}
                                alt={title}
                                className="h-full w-full object-contain rounded-md"
                            />
                        </div>
                    ) : (
                        <object
                            data={url}
                            type="application/pdf"
                            className="w-full h-full rounded-lg border"
                        >
                            <div className="flex flex-col items-center justify-center h-full gap-4">
                                <p className="text-muted-foreground text-center">
                                    Unable to display file preview. Open it in a new tab.
                                </p>
                                <Button asChild>
                                    <a href={url} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open File in New Tab
                                    </a>
                                </Button>
                            </div>
                        </object>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
