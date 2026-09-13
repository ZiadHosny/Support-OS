import { PlusIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { Can } from '@/shared/auth'
import { useDebouncedSearch } from '@/shared/hooks/useDebouncedSearch'
import { LandingIcon } from '@/shared/landing'
import { Button } from '@/shared/ui/primitives/button'
import { Input } from '@/shared/ui/primitives/input'
import { DataTable } from '@/shared/ui/data-table/DataTable'
import { DeleteRowButton } from '@/shared/ui/data-table/DeleteRowButton'
import { TableLink } from '@/shared/ui/data-table/TableLink'
import type { ColumnDef } from '@/shared/ui/data-table/types'
import { useServerTable } from '@/shared/ui/data-table/useServerTable'
import { useConfirm } from '@/shared/ui/confirm/useConfirm'
import { Empty } from '@/shared/ui/Empty'
import { PageHeader } from '@/shared/ui/PageHeader'

import { useDeleteLandingHighlight } from '../api/useLandingHighlightMutations'
import { useLandingHighlightList } from '../api/useLandingHighlightList'
import type { LandingHighlightRow } from '../types/landing'

/**
 * The highlight-card management screen — LAND-2. `DepartmentListPage`'s
 * shape, ordered by `order` rather than alphabetically.
 *
 * One permission, not the `view`/`manage` split `departments` uses: nothing
 * in the staff app reads highlights except this screen, so there is no
 * read-only consumer to widen for. The `<Can>` wrappers stay anyway — they
 * cost nothing and keep the pattern uniform if that ever changes.
 */
export function LandingHighlightListPage() {
  const { t } = useTranslation('organization')
  const { confirm } = useConfirm()
  const { sort, setSort, setPage, params } = useServerTable({
    initialSort: { field: 'order', direction: 'asc' },
  })

  const { searchInput, setSearchInput, search } = useDebouncedSearch(setPage)

  const query = useLandingHighlightList({ ...params, ...(search ? { search } : {}) })
  const deleteMutation = useDeleteLandingHighlight()

  async function handleDelete(highlight: LandingHighlightRow) {
    const confirmed = await confirm({
      title: t('landingHighlights.delete.title'),
      description: t('landingHighlights.delete.description'),
      destructive: true,
    })
    if (!confirmed) return
    await deleteMutation.mutateAsync(highlight.id)
  }

  const columns: readonly ColumnDef<LandingHighlightRow>[] = [
    {
      id: 'order',
      header: t('landingHighlights.fields.order'),
      sortable: true,
      cell: (row) => row.order,
    },
    {
      id: 'title_en',
      header: t('landingHighlights.fields.titleEn'),
      sortable: true,
      cell: (row) => (
        <TableLink to={`/settings/landing/highlights/${String(row.id)}/edit`}>
          {row.title_en}
        </TableLink>
      ),
    },
    {
      id: 'title_ar',
      // Not sortable: absent from `LandingHighlightViewSet.ordering_fields`,
      // the same rule every secondary column in this codebase follows.
      header: t('landingHighlights.fields.titleAr'),
      cell: (row) => <span dir="auto">{row.title_ar}</span>,
      priority: 'sm',
    },
    {
      id: 'icon',
      header: t('landingHighlights.fields.icon'),
      // The component, not the stored key — the key is an implementation
      // detail and an admin recognises the picture they picked.
      cell: (row) => <LandingIcon icon={row.icon} className="size-4 text-muted-foreground" />,
      priority: 'sm',
    },
    {
      id: 'actions',
      header: t('landingHighlights.fields.actions'),
      cell: (row) => (
        <Can permission="settings.manage">
          <DeleteRowButton onClick={() => void handleDelete(row)}>
            {t('landingHighlights.actions.delete')}
          </DeleteRowButton>
        </Can>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('landingHighlights.title')}
        action={
          <Can permission="settings.manage">
            <Button asChild>
              <Link to="/settings/landing/highlights/new">
                <PlusIcon />
                {t('landingHighlights.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      <Input
        value={searchInput}
        onChange={(event) => setSearchInput(event.target.value)}
        placeholder={t('landingHighlights.searchPlaceholder')}
        aria-label={t('landingHighlights.search')}
      />
      <DataTable
        columns={columns}
        query={query}
        rowKey={(row) => String(row.id)}
        sort={sort}
        onSortChange={setSort}
        onPageChange={setPage}
        caption={t('landingHighlights.title')}
        empty={
          search ? (
            <Empty title={t('landingHighlights.noSearchResults')} />
          ) : (
            // The empty description MUST say the shipped cards still render.
            // An admin who deletes every row, visits `/`, and sees four cards
            // would otherwise conclude the delete silently failed.
            <Empty
              title={t('landingHighlights.empty')}
              description={t('landingHighlights.emptyDescription')}
            />
          )
        }
      />
    </div>
  )
}
