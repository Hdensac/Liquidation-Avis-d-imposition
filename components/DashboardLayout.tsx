// components/DashboardLayout.tsx
import { Tab } from "@headlessui/react";
import React, { ReactNode } from "react";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const tabs = ["Nouvelle liquidation", "En attente", "Historique"]; // French labels

  return (
    <Tab.Group>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
        {/* Header with tab navigation */}
        <Tab.List className="flex space-x-1 rounded-xl bg-gray-200 dark:bg-gray-800 p-1 mt-4 mx-4">
          {tabs.map((tab) => (
            <Tab
              key={tab}
              className={({ selected }) =>
                `w-full py-2.5 text-sm leading-5 font-medium rounded-lg focus:outline-none
                 ${selected ? "bg-white dark:bg-gray-700 shadow" : "text-gray-600 dark:text-gray-300 hover:bg-white/[0.12]"}`
              }
            >
              {tab}
            </Tab>
          ))}
        </Tab.List>
        {/* Content panels */}
        <Tab.Panels className="flex-1 p-6 overflow-auto">
          {React.Children.map(children, (child) => (
            <Tab.Panel>{child}</Tab.Panel>
          ))}
        </Tab.Panels>
      </div>
    </Tab.Group>
  );
}

// Optional named component for external usage (not strictly required)
DashboardLayout.TabPanel = function TabPanel({ children }: { children: ReactNode }) {
  return <>{children}</>;
};
