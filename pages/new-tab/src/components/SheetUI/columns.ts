import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { FaStar } from 'react-icons/fa';
import type { RowData, AutomationModuleRow } from './types';

export const columns: ColumnDef<RowData | AutomationModuleRow>[] = [
  {
    header: 'Title',
    accessorKey: 'name',
    size: 200,
  },
  {
    header: 'Edit / URL',
    accessorKey: 'url',
    size: 240,
  },
  {
    header: 'Folder Path',
    accessorKey: 'folder',
    size: 130,
  },
  {
    header: 'Favs',
    accessorKey: 'fav',
    id: 'fav',
    size: 45,
    enableSorting: false,
    sortingFn: 'basic',
  },
  {
    header: 'Keyboard Key',
    accessorKey: 'key',
    size: 115,
  },
  {
    header: '/ Command',
    accessorKey: 'command',
    size: 100,
  },
  {
    header: '',
    accessorKey: 'id',
    size: 40,
    enableSorting: false,
  },
];
