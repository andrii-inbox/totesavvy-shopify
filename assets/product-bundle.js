if (!window.Romanics.loadedScript.has('product-bundle.js')) {
window.Romanics.loadedScript.add('product-bundle.js');

requestAnimationFrame(() => {
  document.addEventListener("alpine:init", () => {
    Alpine.data('xProductBundle', (
      sectionId,
      minimumItems,
      shopCurrency,
      discountType,
      discountValue,
      applyDiscountOncePerOrder
    ) => ({
      products: "",
      productsBundle: [],
      loading: false,
      addToCartButton: "",
      totalPrice: 0,
      errorMessage: false,
      totalDiscount: 0,
      amountPrice: 0,
      initBundle(el) {
        this.addToCartButton = el.querySelector(".button-atc");
        this.handleProductsBundle();
        const saved = sessionStorage.getItem("bundle-" + sectionId);
        if (saved) {
          this.productsBundle = JSON.parse(saved);
          this.updateBundleContent(this.productsBundle);
          setTimeout(() => {
            document.dispatchEvent(new CustomEvent(`romanics:product-bundle:productsCard-cached-${sectionId}`, {
              detail: {
                productsList: this.productsBundle
              }
            }));
          }, 500); 
        }
      },
      handleProductsBundle() {
        this.$watch('productsBundle', () => {
          document.dispatchEvent(new CustomEvent(`romanics:product-bundle:productsList-changed-${sectionId}`, {
            detail: {
              productsBundle: this.productsBundle
            }
          }));
          sessionStorage.setItem("bundle-" + sectionId, JSON.stringify(this.productsBundle));
        });
      },
      _getSelectedValueId(el) {
        return el.querySelector("select option[selected][value], fieldset input:checked")?.dataset.optionValueId;
      },
      _getCurrentVariantEl(el) {
        return el.querySelector(`script[type="application/json"][data-option-value-id='${this._getSelectedValueId(el)}']`);
      },
      _getCurrentVariable(el) {
        return JSON.parse(this._getCurrentVariantEl(el)?.textContent);
      },
      addToBundle(el, productId, productUrl, hasVariant, name_edt) {
        let productsBundle = JSON.parse(JSON.stringify(this.productsBundle))
        const productName = el.closest(".x-product-bundle-data").querySelector(".product-name").textContent;
        const currentVariant = hasVariant ? this._getCurrentVariable(el.closest(".x-product-bundle-data")) : JSON.parse(el.closest(".x-product-bundle-data").querySelector(`script[type='application/json'][data-id='${productId}']`).textContent);
        const price = !hasVariant && JSON.parse(el.closest(".x-product-bundle-data").querySelector(".current-price")?.textContent);
        const featured_image = currentVariant.featured_image ? currentVariant.featured_image.src : el.closest(".x-product-bundle-data").querySelector(".featured-image").textContent;
        const edtElement = el.closest(".x-product-bundle-data").querySelector(`.hidden.cart-edt-properties-${productId}`);
        let shippingMessage = '';
        if(edtElement){
          shippingMessage = edtElement.value.replace("time_to_cut_off", Alpine.store('xEstimateDelivery').noti);
        }
        const preorderElement = el.closest(".x-product-bundle-data").querySelector('.hidden.preorder-edt-properties');
        let preorderMessage = '';
        if(preorderElement){
          preorderMessage = preorderElement.value;
        }
        
        const properties = {
          ...(name_edt && shippingMessage && { [name_edt]: shippingMessage }),
          ...(preorderMessage && { Preorder: preorderMessage }),
        };

        let variantId = hasVariant ? currentVariant : currentVariant.id; 
        let newProductsBundle = [];
        let newItem = hasVariant ? { ...currentVariant, title: currentVariant.title.replaceAll("\\",""), product_id: productId, product_name: productName, productUrl: `${productUrl}?variant=${currentVariant.id}`, featured_image: featured_image, quantity: 1, "properties": properties} : { id: variantId, product_id: productId, product_name: productName, productUrl: productUrl, featured_image: featured_image, quantity: 1, price: price, "properties": properties }
        
        newProductsBundle = [...productsBundle , newItem];
        this.productsBundle = newProductsBundle;
        this.errorMessage = false;
        this.updateBundleContent(newProductsBundle)
        let bundleContentContainer = document.getElementById(`bundle-content-container-${sectionId}`);
        requestAnimationFrame(() => {
          let splide = bundleContentContainer.splide;
          if (splide) {
            splide.refresh();
            let lastIndex = splide.Components.Controller.getEnd();
            splide.go(lastIndex);
          }
        });
      },
      async handleAddToCart(el) {
        this.loading = true;
        await Alpine.store('xCartHelper').waitForCartUpdate();
        window.updatingCart = true;

        setTimeout(() => { 
          let items = JSON.parse(JSON.stringify(this.productsBundle));
          items = items.reduce((data, product) => {
            data[product.id] ? data[product.id].quantity += product.quantity : data[product.id] = product;
            return data;
          }, {});
          
          fetch(window.Shopify.routes.root + 'cart/add.js', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body:  JSON.stringify({ "items": items, "sections":  Alpine.store('xCartHelper').getSectionsToRender().map((section) => section.id) })
          }).then((response) => {
            return response.json();
          }).then((response) => {

            document.dispatchEvent(new CustomEvent(`romanics:product-bundle:products-changed-${sectionId}`, {
              detail: {
                productsBundle: Object.values(items),
                el: el.closest(".product-bundler-wrapper")
              }
            }));

            if (response.status == '422') {
              const errorMessage = el.closest('.bundler-sticky').querySelector('.cart-warning');

              this.errorMessage = true;
              if (errorMessage) {
                errorMessage.textContent = response.description;
              }
              return;
            }
            this.errorMessage = false;
            Alpine.store('xCartHelper').reRenderSections(response.sections);
            if (Alpine.store('xQuickView') && Alpine.store('xQuickView').show) {
              Alpine.store('xQuickView').show = false;
            }
            Alpine.store('xPopup').close();
            if (Alpine.store('xCartNoti') && Alpine.store('xCartNoti').enable) {
              Alpine.store('xCartNoti').setItem(response); 
            } else {
              Alpine.store('xMiniCart').openCart();
              document.dispatchEvent(new CustomEvent("romanics:cart:redirect"));
            }
            Alpine.store('xCartHelper').currentItemCount = parseInt(document.getElementById('cart-icon-bubble').innerHTML);
            document.dispatchEvent(new CustomEvent("romanics:cart:items-changed"));
          })
          .catch((error) => {
            console.error('Error:', error);
          }).finally(() => {
            window.updatingCart = false;
            this.loading = false;
            this.productsBundle = [];
            this.totalPrice = 0;
            this.addToCartButton.setAttribute('disabled', 'disabled');
          })
        }, 0)
      },
      updateBundleContent(productsBundle) {
        let total = productsBundle.map(item => item.price).reduce((total, item) => total + item, 0);
        
        if (productsBundle.length >= minimumItems) {
          this.addToCartButton.removeAttribute('disabled');
          let discount = 0;
          let totalDiscount = 0;

          if (!Number.isNaN(discountValue)) {
            discount = Number(discountValue);

            if (discountType == 'percentage' && Number.isInteger(discount) && discount > 0 && discount < 100) {
              totalDiscount = Math.ceil(total - total * discount / 100);
            }

            if (discountType == 'amount' && discount > 0) {
              discount = (Number.parseFloat(discountValue)).toFixed(2);
              if (applyDiscountOncePerOrder) {
                totalDiscount = total - discount * Shopify.currency.rate * 100;
              } else {
                totalDiscount = total - productsBundle.length * discount * Shopify.currency.rate * 100;
              }
            }

            if (totalDiscount > 0) {
              let amount = total - totalDiscount;
              this.amountPrice = Alpine.store('xHelper').formatMoney(amount, shopCurrency);
              this.totalDiscount = Alpine.store('xHelper').formatMoney(totalDiscount, shopCurrency);
            } else {
              this.amountPrice = Alpine.store('xHelper').formatMoney(0, shopCurrency);
              this.totalDiscount = Alpine.store('xHelper').formatMoney(total, shopCurrency)
            }
          } else {
            this.amountPrice = 0;
            this.totalDiscount = 0;
          }
        } else {
          this.totalDiscount = 0;
          this.addToCartButton.setAttribute('disabled', 'disabled');
        }
        this.totalPrice = Alpine.store('xHelper').formatMoney(total, shopCurrency);
      },
      removeBundle(el, indexItem) {
        let item = this.productsBundle[indexItem]
        let newProductsBundle = this.productsBundle.filter((item, index) => index != indexItem)
        this.productsBundle = newProductsBundle;
        this.updateBundleContent(newProductsBundle);
        let bundleContentContainer = document.getElementById(`bundle-content-container-${sectionId}`);
        requestAnimationFrame(() => {
          let splide = bundleContentContainer.splide;
          if (splide) {
            splide.refresh();
            let lastIndex = splide.Components.Controller.getEnd();
            splide.go(lastIndex);
          }
        });

        document.dispatchEvent(new CustomEvent(`romanics:product-bundle:remove-item-${sectionId}`, {
          detail: {
            item: item,
            el: el
          }
        }));
      },
      displayDiscountValueLabel () {
        let discount = 0;
        if (!Number.isNaN(discountValue)) {
          discount = Number(discountValue);
          if (discount > 0) {
            discount = (Number.parseFloat(discountValue)).toFixed(2) * Shopify.currency.rate * 100;
          }
          return Alpine.store('xHelper').formatMoney(discount, shopCurrency);
        }
      }
    }));

    Alpine.data('xProductItemBundle', (
      sectionId,
      addToBundle,
      unavailableText,
      soldoutText,
      addedText,
      handleSectionId,
      productUrl,
      productId,
      hasVariant,
      productOnlyAddedOnce
    ) => ({
      productsList: [],
      dataVariant: [],
      currentVariant: '',
      isSelect: false,
      productId: productId,
      productUrl: productUrl,
      initEvent() {
        if (hasVariant) {
          document.addEventListener(`romanics:product-card-variant-select:updated:${sectionId}:${productUrl}`, (e) => {
            this.currentVariant = e.detail.currentVariant,
            this.renderAddToBundleButton();
            this.checkVariantSelected();
            if (this.currentVariant && this.currentVariant.id) {
              this.productUrl = productUrl + `/?variant=${this.currentVariant.id}`
            }
          });
          document.addEventListener(`romanics:card-product-bundle:productsList-changed-${handleSectionId}`, (e) => {
            this.productsList = e.detail.productsList;
          });
        } else {
          document.addEventListener(`romanics:product-bundle:productsCard-cached-${handleSectionId}`, (e) => {
            const buttonATB = document.getElementById('x-atc-button-' + sectionId);
            if (!buttonATB) return;
            const item = e.detail.productsList.find(({ product_id }) => product_id === this.productId);
            if (item) {
              buttonATB.setAttribute('disabled', 'disabled');
            }
          });
        }

        document.addEventListener(`romanics:product-bundle:products-changed-${handleSectionId}`, (e) => {
          e.detail.productsBundle.map(item => {
            if(hasVariant && item.product_id == this.productId && this.currentVariant.available) {
              let buttonATC = document.getElementById('x-atc-button-' + sectionId);
              if (buttonATC) buttonATC.removeAttribute('disabled');
            } else if(item.product_id == this.productId) {
              let buttonATC = document.getElementById('x-atc-button-' + sectionId);
              if (buttonATC) buttonATC.removeAttribute('disabled');
            }
          })
          if(productOnlyAddedOnce) {
            this.setUnSelectVariant();
          }
        })

        document.addEventListener(`romanics:product-bundle:remove-item-${handleSectionId}`, (e) => {
          if (this.isSelect && e.detail.item.product_id == this.productId && hasVariant) {
            if (this.currentVariant && this.currentVariant.available) {
              let buttonATC = document.getElementById('x-atc-button-' + sectionId);
              if (buttonATC) {
                buttonATC.removeAttribute('disabled');
                const addButtonText = buttonATC.querySelector('.x-atc-text');
                if (addButtonText) addButtonText.textContent = addToBundle
              }
            }
            this.setUnSelectVariant(e.detail.item);
          } else if(e.detail.item.product_id == this.productId) { 
            let buttonATC = document.getElementById('x-atc-button-' + sectionId);
            if (buttonATC) {
              buttonATC.removeAttribute('disabled');
              const addButtonText = buttonATC.querySelector('.x-atc-text');
              if (addButtonText) addButtonText.textContent = addToBundle;
            }

            if(productOnlyAddedOnce) {
              const cardProducts = document.getElementById('bundle-product-' + e.detail.item.product_id);
              cardProducts?.classList.remove("cursor-pointer", "pointer-events-none", "opacity-70")
            }
          }
        })
      },
      setVariantSelected(el) {
        if (this.currentVariant && this.dataVariant.findIndex(item => (item.id == this.currentVariant.id && item.disable)) != -1) {
          let buttonATB = el.closest('.bundle-product').querySelector('.x-atb-button');
          buttonATB.setAttribute('disabled', 'disabled');
        }
      },
      setDisableSelectProduct(el) {
        if (productOnlyAddedOnce) {
          let newVariants = JSON.parse(JSON.stringify(this.dataVariant)).map(item => (item.id == this.currentVariant.id) ? { id: item.id, disable: true } : { id: item.id, disable: item.disable})
          this.dataVariant = newVariants;
          let buttonATB = el.closest('.bundle-product').querySelector('.x-atb-button');
          buttonATB.setAttribute('disabled', 'disabled');
          const addButtonText = buttonATB.querySelector('.x-atc-text');
          if (addButtonText) addButtonText.textContent = addedText;
        }
      },
      setUnSelectVariant(product) {
        let newVariants = "";
        if (product) {
          newVariants = JSON.parse(JSON.stringify(this.dataVariant)).map(item => (item.id == product.id) ? { id: item.id, disable: false } : { id: item.id, disable: item.disable})
        } else {
          newVariants = JSON.parse(JSON.stringify(this.dataVariant)).map(item => ({ id: item.id, disable: false }))
        }
        this.dataVariant = newVariants;
      },
      renderAddToBundleButton() {
        const buttonATB = document.getElementById('x-atc-button-' + sectionId)

        if (!buttonATB) return;

        const addButtonText = buttonATB.querySelector('.x-atc-text');

        if (addButtonText) {
          if (this.currentVariant) {
            const itemVariant = this.productsList.find(({ id }) => id === this.currentVariant.id);
            if (itemVariant && buttonATB) {
              setTimeout(() => {
                buttonATB.setAttribute('disabled', 'disabled');
                if (this.currentVariant.available) {
                  addButtonText.textContent = addToBundle;
                } else {
                  addButtonText.textContent = soldoutText;
                }
                return;
              }, 100);
            }
            if (this.currentVariant.available) {
              buttonATB.removeAttribute('disabled');
              addButtonText.textContent = addToBundle;
            } else {
              addButtonText.textContent = soldoutText;
            }
          } else {
            addButtonText.textContent = unavailableText;
          }
        }
      },
      checkVariantSelected() {
        const fieldset = [...document.querySelectorAll(`#variant-update-${sectionId} fieldset`)];
        if(fieldset.findIndex(item => !item.querySelector("input:checked")) == "-1") {
          this.isSelect = true;
        }
      }
    }));

    Alpine.data('xProductList', (
      handleSectionId
    ) => ({
      productsList: [],
      init() {
        document.addEventListener(`romanics:product-bundle:productsList-changed-${handleSectionId}`, (e) => {
          this.productsList = e.detail.productsBundle;
          document.dispatchEvent(new CustomEvent(`romanics:card-product-bundle:productsList-changed-${handleSectionId}`, {
            detail: {
              productsList: this.productsList
            }
          }));
        })
      }
    }))
  });
});
}