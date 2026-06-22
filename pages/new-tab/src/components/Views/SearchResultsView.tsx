import { useEffect, useState } from 'react';
import type { Workspace, Folder, Snippet } from '../../../../modals/interfaces';
import { ListItem } from '../Items/ListItem';
import { CiSearch as Search } from 'react-icons/ci';

interface Props {
  results: {
    workspace: Workspace;
    folder: Folder | null;
    snippets: Snippet[];
  }[];
  userId: string;
  viewMode: 'list' | 'grid';
  selectedTeamId: string;
  searchTerm: string;
  reload: () => void;
}

const SearchResultsView: React.FC<Props> = ({ results, userId, viewMode, selectedTeamId, searchTerm, reload }) => {
  const [favoritesMapping, setFavoritesMapping] = useState<{
    [teamId: string]: Snippet[];
  }>({});

  // Calculate total snippets
  const totalSnippets = results.reduce((total, { snippets }) => total + snippets.length, 0);

  useEffect(() => {
    chrome.storage.local.get('myFavouriteItems', result => {
      setFavoritesMapping(result.myFavouriteItems || {});
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = (changes: any, namespace: string) => {
      if (namespace === 'local' && changes.myFavouriteItems && selectedTeamId) {
        setFavoritesMapping(changes.myFavouriteItems.newValue || {});
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, [selectedTeamId]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="bg-gray-100 p-4 rounded-full mb-4">
          <Search size={48} className="text-[var(--color-iconDefault)]" />
        </div>
        <h2 className="text-2xl font-semibold text-[var(--color-textPrimary)] mb-2">No results found</h2>
        <p className="text-gray-600 max-w-md">
          We couldn't find anything matching "{searchTerm}". Try using different or more general keywords.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="p-6 space-y-6 animate-[fadeIn_0.3s_ease-in-out] overflow-y-auto flex-1 relative z-10">
        {/* Search results header */}
        <div className="border-b border-[var(--color-borderDefault)] pb-4 last:border-0">
          <h1 className="text-2xl font-bold text-[var(--color-textPrimary)]">
            Search results for "<span className="text-blue-600 dark:text-blue-400">{searchTerm}</span>"
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Found {totalSnippets} {totalSnippets === 1 ? 'snippet' : 'snippets'} across {results.length}{' '}
            {results.length === 1 ? 'location' : 'locations'}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto hide-scrollbar">
          {results.map(({ workspace, folder, snippets }) => (
            <div
              key={`${workspace.workspace_id}-${folder?.folder_id || 'workspace-snippets'}`}
              className="border-b border-[var(--color-borderDefault)] pb-6 last:border-0">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-textPrimary)] group flex items-center">
                  <span>{workspace.workspace_name}</span>
                  {folder && (
                    <>
                      <span className="mx-2 text-gray-400">/</span>
                      <span>{folder.folder_name}</span>
                    </>
                  )}
                  {!folder && (
                    <span className="ml-3 bg-[var(--color-containerBg)] text-neutral-600 dark:text-neutral-300 text-sm px-2 py-0.5 rounded-full">
                      Workspace Snippets
                    </span>
                  )}
                  <span className="ml-3 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm px-2 py-0.5 rounded-full">
                    {snippets.length}
                  </span>
                </h2>
              </div>

              <div className="flex flex-col gap-3 transition-all duration-300">
                {snippets.map((snippet, index) => (
                  <ListItem
                    key={snippet.id}
                    userId={userId}
                    snippet={snippet}
                    workspace={workspace}
                    folder={folder}
                    reload={reload}
                    selectedItem={null}
                    selectedTeamId={selectedTeamId}
                    favoritesMapping={favoritesMapping}
                    setFavoritesMapping={setFavoritesMapping}
                    index={index}
                    moveSnippet={() => {}}
                    snippetList={snippets}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchResultsView;
