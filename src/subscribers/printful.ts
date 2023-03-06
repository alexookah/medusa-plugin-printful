import {kebabCase} from "lodash";


class PrintfulSubscriber {
    private printfulSyncService: any;
    private productService: any;
    private orderService_: any;
    private printfulFulfillmentService: any;
    private fulfillmentService: any;
    private printfulService: any;
    private productVariantService: any;

    constructor({
                    eventBusService,
                    orderService,
                    printfulSyncService,
                    productService,
                    printfulFulfillmentService,
                    fulfillmentService,
                    printfulService,
                    productVariantService
                }) {
        this.printfulSyncService = printfulSyncService;
        this.productService = productService
        this.printfulFulfillmentService = printfulFulfillmentService;
        this.orderService_ = orderService;
        this.fulfillmentService = fulfillmentService;
        this.printfulService = printfulService;
        this.productVariantService = productVariantService;

        eventBusService.subscribe("printful.product_updated", this.handlePrintfulProductUpdated);
        eventBusService.subscribe("printful.product_deleted", this.handlePrintfulProductDeleted);
        eventBusService.subscribe("printful.order_updated", this.handlePrintfulOrderUpdated);
        eventBusService.subscribe("printful.package_shipped", this.handlePrintfulPackageShipped);

        eventBusService.subscribe("order.placed", this.handleOrderCreated);
        eventBusService.subscribe("order.updated", this.handleOrderUpdated);
        eventBusService.subscribe("order.completed", this.handleOrderCompleted);
        eventBusService.subscribe("payment.payment_captured", this.handlePaymentCaptured);
        eventBusService.subscribe("product.updated", this.handleMedusaProductUpdated);
        eventBusService.subscribe("product-variant.updated", this.handleMedusaVariantUpdated);
    }

    handlePrintfulProductUpdated = async (data: any) => {
        console.log("From handlePrintfulProductUpdated subscriber:", data)

        const {
            sync_product: printfulProduct,
            sync_variants: printfulProductVariants
        } = await this.printfulService.getSyncProduct(data.data.sync_product.id);

        const listedProducts = await this.productService.list({external_id: printfulProduct.id});

        if (listedProducts.length === 0) {
            console.log(`Couldn't update product with id ${printfulProduct.id} in Medusa, does it exist? \n ${printfulProduct}`)
            return;
        } else if (listedProducts.length > 1) {
            console.log(`Found multiple products with id ${printfulProduct.id} in Medusa, this shouldn't happen!`)
            return;
        }

        const updatedProduct = await this.printfulService.updateProduct(listedProducts[0].id, {
            title: printfulProduct.name,
            handle: kebabCase(printfulProduct.name),
            thumbnail: printfulProduct.thumbnail_url,
            external_id: printfulProduct.id,
            metadata: {
                printful_id: printfulProduct.id,
                printful_synced_at: new Date().toISOString(),
            }
        }, "fromPrintful");

        if (updatedProduct) {


        }


    }

    handlePrintfulProductDeleted = async (data: any) => {
        console.log("From subscriber - processing following event:", data)
        const existingProduct = await this.productService.list({external_id: data.data.sync_product.id});
        if (existingProduct.length === 0) {
            console.log(`Couldn't delete product with id ${data.data.sync_product.id} in Medusa, it does not exist`)
            return;
        }
        await this.productService.delete(existingProduct.id)

    }

    handlePrintfulOrderUpdated = async (data: any) => {
        console.log("From handlePrintfulOrderUpdated - processing following event:", data)
        const testOrderId = "order_01GTJ15739CSGA3VZ7P56J111B"
        // data.data.order.external_id
        data.data.order.status = "inprocess";
        const order = await this.orderService_.retrieve(testOrderId, {relations: ["items", "fulfillments", "payments", "shipping_methods", "billing_address"]});
        if (order) {
            if (data.data.order.status === "inprocess") {
                console.log(order.shipping_methods)
                try {
                    const fulfillment = await this.fulfillmentService.createFulfillment(order, order.items)
                    console.log(fulfillment)
                } catch (e) {
                    console.log(e)
                }
            }

        }

    }


    handlePrintfulPackageShipped = async (data: any) => {
        console.log("From subscriber - processing following event:", data)
        const orderData = data.data.order;
        const shipmentData = data.data.shipment;

        const order = await this.orderService_.retrieve(orderData.external_id);

    }

    handleMedusaProductUpdated = async (data: any) => {
        console.log("From subscriber - processing handleMedusaProductUpdated: -- NOT YET IMPLEMENTED", data)
    }

    handleMedusaVariantUpdated = async (data: any) => {
        console.log("From subscriber - processing handleMedusaVariantUpdated: -- NOT YET IMPLEMENTED", data)
    }

    handleOrderCreated = async (data: any) => {
        console.log("From subscriber - processing following event:", data)
        // TODO: Add logic to create order in printful
        const order = await this.orderService_.retrieve(data.id);
        if (order) {
            await this.printfulFulfillmentService.createOrder(order)
        }
    }


    handleOrderUpdated = async (data: object) => {
        console.log("From subscriber - processing following event:", data)

    }

    handleOrderCompleted = async (data: object) => {
        console.log("From subscriber - processing following event:", data)
    }

    handlePaymentCaptured = async (order: any) => {
        console.log("From subscriber - processing following event:", order)
        const approveOrder = await this.printfulFulfillmentService.confirmDraftForFulfillment(order.id);
        if (approveOrder) {
            console.log(approveOrder)
        }
    }
}

export default PrintfulSubscriber;