import type React from 'react';
import { useEffect, useState } from 'react';

interface LinkContainerProps {
  linkKey: string;
  setLinkKey: (val: string) => void;
  linkValue: string;
  setLinkValue: (val: string) => void;
}

const LinkContainer: React.FC<LinkContainerProps> = ({ linkKey, linkValue, setLinkKey, setLinkValue }) => {
  return (
    <>
      {/* Note Key Input */}
      <div className="p-4 bg-gray-100 dark:bg-gray-800">
        <input
          value={linkKey}
          onChange={e => setLinkKey(e.target.value)}
          type="text"
          placeholder="Enter key"
          className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white p-2 rounded"
        />
      </div>

      {/* Main Text Area */}
      <textarea
        value={linkValue}
        onChange={e => setLinkValue(e.target.value)}
        placeholder="Start typing..."
        className="flex-1 w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white p-4 resize-none outline-none"
      />
    </>
  );
};

export default LinkContainer;
