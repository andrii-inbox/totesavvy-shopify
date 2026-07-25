
if (!window.Romanics.loadedScript.has('product-insurance.js')) {
  window.Romanics.loadedScript.add('product-insurance.js');
  
  requestAnimationFrame(() => {
    document.addEventListener("alpine:init", () => {
      Alpine.store('xPopupInsurance', {
        open: false,
        loading: false,
        openInsuranceNoti: false,
        openInsuranceNotification() {
          this.openInsuranceNoti = true;
          setTimeout(() => {
            this.openInsuranceNoti = false;
          }, 5000)
        }
      });
    });
  });
}