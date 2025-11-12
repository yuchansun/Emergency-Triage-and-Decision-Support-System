import React from 'react';

const PatientInfo: React.FC = () => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-content-light dark:border-content-dark bg-background-light/80 dark:bg-background-dark/80 px-10 py-3 backdrop-blur-sm">
      <div className="flex items-center gap-4">
        <div className="text-primary w-8 h-8">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM24 28H16V20H24V14L32 22L24 30V28Z" fill="currentColor"></path>
          </svg>
        </div>
        <h2 className="text-xl font-bold">急診檢傷系統</h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 text-sm text-subtext-light dark:text-subtext-dark">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-light dark:text-text-dark">王大明</span>
            <span>(女, 35歲)</span>
          </div>
          <div className="h-4 w-px bg-content-dark"></div>
          <span>A123456789</span>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-sm text-subtext-light dark:text-subtext-dark">護理師:王小明</p>
          <button
            className="size-10 rounded-full bg-cover bg-center"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuBOoswmkipx2627CBEIP1TnOu8LHLGqCPMAJmzDPQ8eZvFRI9NJ2MHGHYj_e3vrsYn1qMSAdv0adZPGp1yAcQUUnMep0zJ-EvF1etiunGFbP4MRF3-UZv5t-Hae582Wctf9TRFvxqk6rhGg5kbOtQU5UCwunCCT9EpEHEeV4dazamlT2c948ERgOT6ZxmGC4CoIpD-fyEE16w9mFbLHvmWy7qZn7PZC9u1-etXUACO36JVvnzdyFauaUU4Na764S1mMAhxKInDMMm4z")' }}
            aria-label="頭像"
          ></button>
        </div>
      </div>
    </header>
  );
};

export default PatientInfo;
