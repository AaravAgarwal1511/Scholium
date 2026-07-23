import { Mark, mergeAttributes } from '@tiptap/core'

export interface PoetHighlightOptions {
    HTMLAttributes: Record<string, unknown>,
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        poetHighlight: {
            /**
             * Set a highlight mark
             */
            setPoetHighlight: (attributes: { id: string, color?: string }) => ReturnType,
            /**
             * Toggle a highlight mark
             */
            togglePoetHighlight: (attributes: { id: string, color?: string }) => ReturnType,
            /**
             * Unset a highlight mark
             */
            unsetPoetHighlight: () => ReturnType,
        }

    }
}

export const PoetHighlight = Mark.create<PoetHighlightOptions>({
    name: 'poetHighlight',

    inclusive: false,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'poet-highlight',
            },
        }
    },

    addAttributes() {
        return {
            id: {
                default: null,
                parseHTML: element => element.getAttribute('data-highlight-id'),
                renderHTML: attributes => {
                    if (!attributes.id) {
                        return {}
                    }

                    return {
                        'data-highlight-id': attributes.id,
                    }
                },
            },
            color: {
                default: 'var(--accent-color)',
                parseHTML: element => element.getAttribute('data-highlight-color'),
                renderHTML: attributes => {
                    if (!attributes.color) {
                        return {}
                    }

                    return {
                        'data-highlight-color': attributes.color,
                        style: `background-color: ${attributes.color}22; border-bottom-color: ${attributes.color}66;`,
                    }
                },
            },
        }
    },



    parseHTML() {
        return [
            {
                tag: 'span[data-highlight-id]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
    },

    addCommands() {
        return {
            setPoetHighlight: attributes => ({ commands }) => {
                return commands.setMark(this.name, attributes)
            },
            togglePoetHighlight: attributes => ({ commands }) => {
                return commands.toggleMark(this.name, attributes)
            },
            unsetPoetHighlight: () => ({ commands }) => {
                return commands.unsetMark(this.name)
            },
        }
    },
})
