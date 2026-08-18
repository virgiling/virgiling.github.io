'use client';

import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { siGithub, siGitlab, siSimpleicons, siZenodo, type SimpleIcon } from 'simple-icons';
import { CardPageConfig } from '@/types/page';

const markdownComponents = {
    p: ({ children }: React.ComponentProps<'p'>) => <p className="mb-3 last:mb-0">{children}</p>,
    ul: ({ children }: React.ComponentProps<'ul'>) => <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>,
    ol: ({ children }: React.ComponentProps<'ol'>) => <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>,
    li: ({ children }: React.ComponentProps<'li'>) => <li className="mb-1">{children}</li>,
    a: ({ ...props }) => (
        <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent font-medium transition-all duration-200 rounded hover:bg-accent/10 hover:shadow-sm"
        />
    ),
    blockquote: ({ children }: React.ComponentProps<'blockquote'>) => (
        <blockquote className="border-l-4 border-accent/50 pl-4 italic my-4 text-neutral-600 dark:text-neutral-500">
            {children}
        </blockquote>
    ),
    strong: ({ children }: React.ComponentProps<'strong'>) => <strong className="font-semibold text-primary">{children}</strong>,
    em: ({ children }: React.ComponentProps<'em'>) => <em className="italic">{children}</em>,
    code: ({ children }: React.ComponentProps<'code'>) => (
        <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[0.95em]">{children}</code>
    ),
};

function getStatusBadgeClass(status: string) {
    switch (status.trim().toLowerCase()) {
        case 'active':
            return 'bg-success/10 text-success border-success/20 dark:bg-success/15 dark:border-success/30';
        case 'wip':
        case 'work in progress':
            return 'bg-warning/10 text-warning border-warning/20 dark:bg-warning/15 dark:border-warning/30';
        case 'transferred':
            return 'bg-info/10 text-info border-info/20 dark:bg-info/15 dark:border-info/30';
        case 'archived':
            return 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:border-neutral-700';
        default:
            return 'bg-neutral-100 text-neutral-600 border-neutral-200 dark:bg-neutral-800/60 dark:text-neutral-400 dark:border-neutral-700';
    }
}

type LinkIconMeta = { icon: SimpleIcon; label: string };

const fallbackLinkIcon: LinkIconMeta = {
    icon: siSimpleicons,
    label: 'external site',
};

const linkIconRules: Array<{ domains: string[] } & LinkIconMeta> = [
    { domains: ['github.com'], icon: siGithub, label: siGithub.title },
    { domains: ['gitlab.com'], icon: siGitlab, label: siGitlab.title },
    { domains: ['zenodo.org'], icon: siZenodo, label: siZenodo.title },
];

function matchesDomain(hostname: string, domain: string) {
    return hostname === domain || hostname.endsWith(`.${domain}`);
}

function getLinkMeta(link: string): LinkIconMeta {
    try {
        const hostname = new URL(link).hostname.toLowerCase().replace(/^www\./, '');
        const rule = linkIconRules.find(({ domains }) =>
            domains.some((domain) => matchesDomain(hostname, domain))
        );

        if (rule) {
            return rule;
        }
    } catch {
        return fallbackLinkIcon;
    }

    return fallbackLinkIcon;
}

function LinkIcon({ meta }: { meta: LinkIconMeta }) {
    return (
        <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d={meta.icon.path} />
        </svg>
    );
}

function CardLink({ link, title }: { link: string; title: string }) {
    const meta = getLinkMeta(link);

    return (
        <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${title} on ${meta.label}`}
            title={`Open ${title} on ${meta.label}`}
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-neutral-500 border border-neutral-200 bg-neutral-50 transition-colors hover:bg-accent hover:text-white hover:border-accent dark:text-neutral-400 dark:border-neutral-800 dark:bg-neutral-800/50"
        >
            <LinkIcon meta={meta} />
        </a>
    );
}

export default function CardPage({ config, embedded = false }: { config: CardPageConfig; embedded?: boolean }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
        >
            <div className={embedded ? "mb-4" : "mb-8"}>
                <h1 className={`${embedded ? "text-2xl" : "text-4xl"} font-serif font-bold text-primary mb-4`}>{config.title}</h1>
                {config.description && (
                    <div className={`${embedded ? "text-base" : "text-lg"} text-neutral-600 dark:text-neutral-500 max-w-2xl leading-relaxed`}>
                        <ReactMarkdown components={markdownComponents}>
                            {config.description}
                        </ReactMarkdown>
                    </div>
                )}
            </div>

            <div className={`grid ${embedded ? "gap-4" : "gap-6"}`}>
                {config.items.map((item, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 * index }}
                        className={`bg-white dark:bg-neutral-900 ${embedded ? "p-4" : "p-6"} rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800 hover:shadow-lg transition-all duration-200 hover:scale-[1.01]`}
                    >
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-2">
                            <div className="flex min-w-0 items-start gap-2">
                                <h3 className={`${embedded ? "text-lg" : "text-xl"} font-semibold text-primary min-w-0 break-words`}>{item.title}</h3>
                                {item.link && (
                                    <CardLink link={item.link} title={item.title} />
                                )}
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                                {item.status && (
                                    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium ${getStatusBadgeClass(item.status)}`}>
                                        {item.status}
                                    </span>
                                )}
                                {item.date && (
                                    <span className="text-sm text-neutral-500 font-medium bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                                        {item.date}
                                    </span>
                                )}
                            </div>
                        </div>
                        {item.subtitle && (
                            <p className={`${embedded ? "text-sm" : "text-base"} text-accent font-medium mb-3`}>{item.subtitle}</p>
                        )}
                        {item.content && (
                            <div className={`${embedded ? "text-sm" : "text-base"} text-neutral-600 dark:text-neutral-500 leading-relaxed`}>
                                <ReactMarkdown components={markdownComponents}>
                                    {item.content}
                                </ReactMarkdown>
                            </div>
                        )}
                        {item.tags && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {item.tags.map(tag => (
                                    <span key={tag} className="text-xs text-neutral-500 bg-neutral-50 dark:bg-neutral-800/50 px-2 py-1 rounded border border-neutral-100 dark:border-neutral-800">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
