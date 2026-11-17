import React from 'react';
import ReactMarkdown from 'react-markdown';

export default function AssistantMessage({ text }: { text: string }) {
  return <div className="min-w-0 break-words text-sm leading-relaxed [&_p]:whitespace-pre-wrap [&_p+p]:mt-3 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-1 [&_h1]:mt-4 [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-black/5 [&_pre]:p-3 [&_code]:font-mono [&_code]:text-xs [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_a]:text-indigo-500 [&_a]:underline">
    <ReactMarkdown skipHtml>{text}</ReactMarkdown>
  </div>;
}
