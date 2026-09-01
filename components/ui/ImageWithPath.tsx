import React from 'react';
import { useImageUrl } from '../../hooks/useImageUrl';

interface ImageWithPathProps {
    src: string;
    alt: string;
    className?: string;
    onClick?: () => void;
}

/**
 * ImageWithPath — renders a local file-path image or a legacy Base64 image.
 * Handles reading files from disk via the Tauri fs API and
 * creating in-memory Blob URLs. Shows a placeholder while loading.
 */
export const ImageWithPath: React.FC<ImageWithPathProps> = ({
    src,
    alt,
    className,
    onClick,
}) => {
    const displayUrl = useImageUrl(src);

    if (!displayUrl) {
        return (
            <div
                className={`flex items-center justify-center bg-gray-100 dark:bg-neutral-800 text-gray-400 text-xs ${className || ''}`}
                style={{ minWidth: 40, minHeight: 40 }}
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="m21 15-5-5L5 21" />
                </svg>
            </div>
        );
    }

    return (
        <img
            src={displayUrl}
            alt={alt}
            className={className}
            onClick={onClick}
        />
    );
};
