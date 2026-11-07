import { unstable_cache } from "next/cache";
import { loadGrowthCatalog } from "./growth";
import { getDepartmentCatalog } from "./colleges";

// These functions never read cookies, user IDs, learning progress, or votes.
// Store only serializable, public catalog DTOs in Next's persistent data cache.
export const getCachedGrowthCatalog = unstable_cache(loadGrowthCatalog, ["public-growth-catalog-v1"], { revalidate: 300, tags: ["growth-catalog"] });
export const getCachedDepartmentCatalog = unstable_cache(getDepartmentCatalog, ["public-department-catalog-v1"], { revalidate: 300, tags: ["growth-catalog"] });
