// useToast.ts
import { useDispatch } from 'react-redux';
import { useCallback } from 'react';
import type { AppDispatch } from '../../../../../Redux/store';
import { queueNotification } from '../../../../../Redux/AllData/uiStateSlice';
const useToast = () => {
  const dispatch: AppDispatch = useDispatch();

  // Memoize the function to prevent unstable references that cause re-renders
  const triggerToast = useCallback(
    (message: string, type?: 'success' | 'error' | 'warning' | 'info') => {
      dispatch(queueNotification({ message, type: type || 'info' }));
    },
    [dispatch],
  );

  return triggerToast;
};

export default useToast;
