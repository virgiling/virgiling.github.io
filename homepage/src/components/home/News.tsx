'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useMessages } from '@/lib/i18n/useMessages';

export interface NewsItem {
    date: string;
    content: string;
}

interface NewsProps {
    items: NewsItem[];
    title?: string;
}

const newsMarkdownComponents = {
    p: ({ children }: React.ComponentProps<'p'>) => <span>{children}</span>,
    strong: ({ children }: React.ComponentProps<'strong'>) => <strong className="text-orange-500">{children}</strong>,
};

export default function News({ items, title }: NewsProps) {
    const messages = useMessages();
    const resolvedTitle = title || messages.home.news;

    return (
        <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
        >
            <h2 className="text-2xl font-serif font-bold text-primary mb-4">{resolvedTitle}</h2>
            <div className="space-y-3">
                {items.map((item, index) => (
                    <div key={index} className="flex items-start space-x-3">
                        <span className="text-xs font-writing text-neutral-500 mt-1 w-30 flex-shrink-0">[{item.date}]</span>
                        <p className="text-base text-neutral-700">
                            <ReactMarkdown components={newsMarkdownComponents}>
                                {item.content}
                            </ReactMarkdown>
                        </p>
                    </div>
                ))}
            </div>
        </motion.section>
    );
}
