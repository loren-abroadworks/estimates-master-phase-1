
import React from 'react';
import { useTranslation } from '@/i18n/LanguageContext';

export const EditableText = ({
    value,
    onChange,
    className = "",
    as: Component = "div",
    placeholder
}: {
    value: string,
    onChange: (val: string) => void,
    className?: string,
    as?: any,
    placeholder?: string
}) => {
    const { t } = useTranslation();
    const resolvedPlaceholder = placeholder ?? t('views.PresentationBuilder.components.EditableText.typeHere');
    return (
        <Component
            contentEditable
            suppressContentEditableWarning
            onBlur={(e: React.FocusEvent<HTMLElement>) => {
                const text = e.currentTarget.innerText;
                if (text !== value) onChange(text);
            }}
            className={`outline-none hover:bg-black/5 rounded px-1 transition-colors cursor-text focus:bg-white focus:text-gray-900 focus:shadow-inner ${!value ? 'min-h-[1em] after:content-[attr(placeholder)] after:text-gray-400' : ''} ${className}`}
            placeholder={resolvedPlaceholder}
            dangerouslySetInnerHTML={{ __html: value }}
        />
    );
};
