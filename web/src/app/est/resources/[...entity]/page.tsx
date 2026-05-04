import { fetchEstPage } from "@/lib/est/client";
import EstResourceEntityList from "@/app/est/resources/[...entity]/components/EstResourceEntityList";

type Props = {
  params: {
    entity: string[];
  };
};

export default async function EstResourceEntityPage({ params }: Props) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const items = await fetchEstPage(entity, { top: 20 });

  return <EstResourceEntityList entity={entity} initialItems={items} />;
}
