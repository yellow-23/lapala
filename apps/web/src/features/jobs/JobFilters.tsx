interface Props {
  search: string;
  remote: boolean;
  onSearch: (v: string) => void;
  onRemote: (v: boolean) => void;
}

export function JobFilters({ search, remote, onSearch, onRemote }: Props) {
  return (
    <div className="flex gap-3 mb-8 flex-wrap">
      <input
        type="text"
        placeholder="Buscar por título..."
        value={search}
        onInput={(e) => onSearch((e.target as HTMLInputElement).value)}
        className="flex-1 min-w-48 border border-neutral-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          checked={remote}
          onChange={(e) => onRemote(e.target.checked)}
          className="rounded"
        />
        Solo remoto
      </label>
    </div>
  );
}
