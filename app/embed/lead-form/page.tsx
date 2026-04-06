'use client';

import LeadForm from '@/components/LeadForm';

export default function EmbedLeadForm() {
  return (
    <div className="min-h-screen bg-white p-4">
      <LeadForm defaultChannel="Website" />
    </div>
  );
}
