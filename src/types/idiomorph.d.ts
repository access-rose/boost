declare module "idiomorph" {
  export type IdiomorphNewContent = Element | Node | HTMLCollection | NodeList | Node[] | string | null

  export type IdiomorphCallbacks = {
    beforeNodeAdded?: (node: Node) => boolean | undefined
    afterNodeAdded?: (node: Node) => void
    beforeNodeMorphed?: (currentElement: Node, newElement: Node) => boolean | undefined
    afterNodeMorphed?: (currentElement: Node, newElement: Node) => void
    beforeNodeRemoved?: (node: Node) => boolean | undefined
    afterNodeRemoved?: (node: Node) => void
    beforeAttributeUpdated?: (
      attributeName: string,
      target: Element,
      mutationType: "update" | "remove"
    ) => boolean | undefined
  }

  export type IdiomorphHeadConfig = {
    style?: "merge" | "append" | "morph" | "none"
    shouldPreserve?: (element: Element) => boolean
    shouldReAppend?: (element: Element) => boolean
    shouldRemove?: (element: Element) => boolean | undefined
    afterHeadMorphed?: (head: Element, added: Node[], kept: Node[], removed: Node[]) => void
  }

  export type IdiomorphConfig = {
    morphStyle?: "outerHTML" | "innerHTML"
    ignoreActive?: boolean
    ignoreActiveValue?: boolean
    restoreFocus?: boolean
    callbacks?: IdiomorphCallbacks
    head?: IdiomorphHeadConfig
  }

  export const Idiomorph: {
    defaults: IdiomorphConfig
    morph(oldNode: Element | Document, newContent: IdiomorphNewContent, config?: IdiomorphConfig): Promise<Node[]> | Node[]
  }
}
