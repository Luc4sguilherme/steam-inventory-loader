/* eslint-disable camelcase */
import type { ItemAsset } from '../../inventory/types/item-asset.type';
import type { ItemDescription } from '../../inventory/types/item-description.type';

export type SteamBodyResponse = {
  rgInventory: ItemAsset[];
  rgDescriptions: ItemDescription[];
  error?: string;
  Error?: string;
  more_start: number;
  more?: number;
  rwgrsn: number;
  success: number;
  total_inventory_count: number;
};
