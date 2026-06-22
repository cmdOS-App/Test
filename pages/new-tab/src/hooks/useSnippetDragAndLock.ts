import { useEffect, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';

export const useSnippetDragAndLock = (snippetId: string, index: number, moveSnippet: Function) => {
  const [isLocked, setIsLocked] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [{ isDragging }, dragRef] = useDrag({
    type: 'SNIPPET',
    item: { id: snippetId, index },
    collect: monitor => ({ isDragging: monitor.isDragging() }),
  });

  const [, dropRef] = useDrop({
    accept: 'SNIPPET',
    hover: (draggedItem: { id: string; index: number }) => {
      if (!ref.current) return;
      const dragIndex = draggedItem.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;
      moveSnippet(dragIndex, hoverIndex);
      draggedItem.index = hoverIndex;
    },
  });

  useEffect(() => {
    dragRef(ref);
    dropRef(ref);
  }, [dragRef, dropRef]);

  useEffect(() => {
    chrome.storage.local.get('lockedItems', result => {
      const lockedItems = result.lockedItems || {};
      setIsLocked(!!lockedItems[snippetId]);
    });
  }, [snippetId]);

  const toggleLock = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    chrome.storage.local.get('lockedItems', result => {
      const lockedItems = result.lockedItems || {};
      const newLockedState = !isLocked;
      if (newLockedState) {
        lockedItems[snippetId] = true;
      } else {
        delete lockedItems[snippetId];
      }
      chrome.storage.local.set({ lockedItems }, () => {
        setIsLocked(newLockedState);
      });
    });
  };

  return { isLocked, toggleLock, isDragging, ref };
};
