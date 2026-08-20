import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Fuel, Wrench, Coins } from "lucide-react";
import { FuelingsSection } from "@/components/sections/FuelingsSection";
import { MaintenanceSection } from "@/components/sections/MaintenanceSection";
import { TollsSection } from "@/components/sections/TollsSection";

export const Route = createFileRoute("/despesas")({
  head: () => ({
    meta: [
      { title: "Despesas — Boiada" },
      {
        name: "description",
        content: "Combustíveis, manutenção e pedágios em um só lugar.",
      },
    ],
  }),
  component: DespesasPage,
});

function DespesasPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Despesas</h2>
        <p className="text-muted-foreground">
          Combustíveis, manutenção e pedágios.
        </p>
      </div>

      <Tabs defaultValue="combustiveis" className="space-y-4">
        <TabsList>
          <TabsTrigger value="combustiveis">
            <Fuel className="mr-1 h-4 w-4" /> Combustíveis
          </TabsTrigger>
          <TabsTrigger value="manutencao">
            <Wrench className="mr-1 h-4 w-4" /> Manutenção
          </TabsTrigger>
          <TabsTrigger value="pedagios">
            <Coins className="mr-1 h-4 w-4" /> Pedágios
          </TabsTrigger>
        </TabsList>
        <TabsContent value="combustiveis" className="space-y-4">
          <FuelingsSection />
        </TabsContent>
        <TabsContent value="manutencao" className="space-y-4">
          <MaintenanceSection />
        </TabsContent>
        <TabsContent value="pedagios" className="space-y-4">
          <TollsSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}