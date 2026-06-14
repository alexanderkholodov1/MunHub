import React from "react";
import { StationDetailClient } from "../../../components/stations/StationDetailClient";

export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

export default function StationDetailPage(): React.ReactElement {
  return <StationDetailClient />;
}
