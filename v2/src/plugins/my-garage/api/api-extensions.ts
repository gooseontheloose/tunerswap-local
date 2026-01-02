import gql from 'graphql-tag';

/**
 * GraphQL schema extensions for the Shop API (customer-facing)
 */
export const shopApiExtensions = gql`
    # ==========================================
    # Types
    # ==========================================

    type VehicleMake {
        id: ID!
        name: String!
        slug: String!
        logoUrl: String
        country: String
    }

    type VehicleModel {
        id: ID!
        makeId: ID!
        make: VehicleMake
        name: String!
        slug: String!
        bodyStyle: String
        category: String
    }

    type VehicleTrim {
        id: ID!
        modelId: ID!
        model: VehicleModel
        name: String!
        slug: String!
        yearStart: Int!
        yearEnd: Int!
        bodyCode: String
        transmission: String
        driveType: String
    }

    type VehicleEngine {
        id: ID!
        trimId: ID!
        trim: VehicleTrim
        code: String!
        displacement: String
        cylinders: Int
        configuration: String
        aspiration: String
        fuelType: String
        horsepower: Int
        torque: Int
    }

    type CustomerVehicle {
        id: ID!
        makeId: ID!
        make: VehicleMake!
        modelId: ID!
        model: VehicleModel!
        year: Int!
        trimId: ID
        trim: VehicleTrim
        engineId: ID
        engine: VehicleEngine
        nickname: String
        notes: String
        isPrimary: Boolean!
        mods: [String!]
        imageUrl: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type CustomerVehicleList {
        items: [CustomerVehicle!]!
        totalItems: Int!
    }

    type YearRange {
        minYear: Int!
        maxYear: Int!
        years: [Int!]!
    }

    type FitmentCheckResult {
        fits: Boolean!
        confidence: Int!
        message: String
        fitmentId: ID
        notes: String
    }

    # ==========================================
    # Inputs
    # ==========================================

    input AddVehicleInput {
        makeId: ID!
        modelId: ID!
        year: Int!
        trimId: ID
        engineId: ID
        nickname: String
        vin: String
        notes: String
        mods: [String!]
        imageUrl: String
        isPrimary: Boolean
    }

    input UpdateVehicleInput {
        trimId: ID
        engineId: ID
        nickname: String
        vin: String
        notes: String
        mods: [String!]
        imageUrl: String
        isPrimary: Boolean
    }

    input VehicleFilterInput {
        makeId: ID!
        modelId: ID
        year: Int
        trimId: ID
        engineId: ID
    }

    # ==========================================
    # Queries
    # ==========================================

    extend type Query {
        "Get all vehicles in customer's garage"
        myGarage: CustomerVehicleList!

        "Get a specific vehicle from customer's garage"
        myVehicle(id: ID!): CustomerVehicle

        "Get customer's primary vehicle"
        myPrimaryVehicle: CustomerVehicle

        "Search vehicle makes by name (typeahead)"
        searchVehicleMakes(term: String!, limit: Int): [VehicleMake!]!

        "Get all active vehicle makes"
        vehicleMakes: [VehicleMake!]!

        "Search vehicle models by name within a make (typeahead)"
        searchVehicleModels(makeId: ID!, term: String!, limit: Int): [VehicleModel!]!

        "Get all models for a specific make"
        vehicleModels(makeId: ID!): [VehicleModel!]!

        "Get year range for a make/model combination"
        vehicleYearRange(makeId: ID!, modelId: ID!): YearRange!

        "Get available years for a make/model"
        vehicleYears(makeId: ID!, modelId: ID): [Int!]!

        "Search trims for a model/year (typeahead)"
        searchVehicleTrims(modelId: ID!, year: Int!, term: String, limit: Int): [VehicleTrim!]!

        "Get all trims for a model/year"
        vehicleTrims(modelId: ID!, year: Int!): [VehicleTrim!]!

        "Get engines for a specific trim"
        vehicleEngines(trimId: ID!): [VehicleEngine!]!

        "Check if a product fits a specific vehicle"
        checkProductFitment(productVariantId: ID!, vehicle: VehicleFilterInput!): FitmentCheckResult!
    }

    # ==========================================
    # Mutations
    # ==========================================

    extend type Mutation {
        "Add a vehicle to customer's garage"
        addVehicleToGarage(input: AddVehicleInput!): CustomerVehicle!

        "Update a vehicle in customer's garage"
        updateGarageVehicle(id: ID!, input: UpdateVehicleInput!): CustomerVehicle!

        "Remove a vehicle from customer's garage"
        removeVehicleFromGarage(id: ID!): Boolean!

        "Set a vehicle as the primary vehicle"
        setPrimaryGarageVehicle(id: ID!): CustomerVehicle!
    }
`;

/**
 * GraphQL schema extensions for the Admin API
 */
export const adminApiExtensions = gql`
    # ==========================================
    # Types (reuse from Shop API via shared fragments)
    # ==========================================

    type VehicleMake {
        id: ID!
        name: String!
        slug: String!
        logoUrl: String
        country: String
        isActive: Boolean!
        sortOrder: Int!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type VehicleModel {
        id: ID!
        makeId: ID!
        make: VehicleMake
        name: String!
        slug: String!
        bodyStyle: String
        category: String
        isActive: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type VehicleTrim {
        id: ID!
        modelId: ID!
        model: VehicleModel
        name: String!
        slug: String!
        yearStart: Int!
        yearEnd: Int!
        bodyCode: String
        transmission: String
        driveType: String
        isActive: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type VehicleEngine {
        id: ID!
        trimId: ID!
        trim: VehicleTrim
        code: String!
        displacement: String
        cylinders: Int
        configuration: String
        aspiration: String
        fuelType: String
        horsepower: Int
        torque: Int
        isActive: Boolean!
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type ProductFitment {
        id: ID!
        productVariantId: ID!
        makeId: ID!
        make: VehicleMake
        modelId: ID
        model: VehicleModel
        yearFrom: Int
        yearTo: Int
        trimId: ID
        engineId: ID
        requiredOptions: JSON
        exclusions: JSON
        source: String!
        confidence: Int!
        isActive: Boolean!
        notes: String
        createdAt: DateTime!
        updatedAt: DateTime!
    }

    type ProductFitmentList {
        items: [ProductFitment!]!
        totalItems: Int!
    }

    type TaxonomyStats {
        totalMakes: Int!
        totalModels: Int!
        totalTrims: Int!
        totalEngines: Int!
        totalCustomerVehicles: Int!
        totalFitmentRules: Int!
    }

    type ImportResult {
        success: Boolean!
        imported: Int!
        skipped: Int!
        errors: [String!]!
        duration: Int!
    }

    # ==========================================
    # Inputs
    # ==========================================

    input CreateVehicleMakeInput {
        name: String!
        slug: String
        logoUrl: String
        country: String
        isActive: Boolean
        sortOrder: Int
    }

    input UpdateVehicleMakeInput {
        name: String
        slug: String
        logoUrl: String
        country: String
        isActive: Boolean
        sortOrder: Int
    }

    input CreateVehicleModelInput {
        makeId: ID!
        name: String!
        slug: String
        bodyStyle: String
        category: String
        isActive: Boolean
    }

    input UpdateVehicleModelInput {
        name: String
        slug: String
        bodyStyle: String
        category: String
        isActive: Boolean
    }

    input CreateVehicleTrimInput {
        modelId: ID!
        name: String!
        slug: String
        yearStart: Int!
        yearEnd: Int!
        bodyCode: String
        transmission: String
        driveType: String
        isActive: Boolean
    }

    input UpdateVehicleTrimInput {
        name: String
        slug: String
        yearStart: Int
        yearEnd: Int
        bodyCode: String
        transmission: String
        driveType: String
        isActive: Boolean
    }

    input CreateVehicleEngineInput {
        trimId: ID!
        code: String!
        displacement: String
        cylinders: Int
        configuration: String
        aspiration: String
        fuelType: String
        horsepower: Int
        torque: Int
        isActive: Boolean
    }

    input UpdateVehicleEngineInput {
        code: String
        displacement: String
        cylinders: Int
        configuration: String
        aspiration: String
        fuelType: String
        horsepower: Int
        torque: Int
        isActive: Boolean
    }

    input CreateProductFitmentInput {
        productVariantId: ID!
        makeId: ID!
        modelId: ID
        yearFrom: Int
        yearTo: Int
        trimId: ID
        engineId: ID
        requiredOptions: JSON
        exclusions: JSON
        source: String
        confidence: Int
        notes: String
    }

    input UpdateProductFitmentInput {
        makeId: ID
        modelId: ID
        yearFrom: Int
        yearTo: Int
        trimId: ID
        engineId: ID
        requiredOptions: JSON
        exclusions: JSON
        source: String
        confidence: Int
        isActive: Boolean
        notes: String
    }

    input BulkFitmentEntry {
        productVariantSku: String!
        makeName: String!
        modelName: String
        yearFrom: Int
        yearTo: Int
        trimName: String
        engineCode: String
        source: String!
    }

    # ==========================================
    # Queries
    # ==========================================

    extend type Query {
        "Get taxonomy statistics for dashboard"
        garageTaxonomyStats: TaxonomyStats!

        "Get all makes (with option to include inactive)"
        garageAllMakes(includeInactive: Boolean): [VehicleMake!]!

        "Get all models for a make (with option to include inactive)"
        garageAllModels(makeId: ID!, includeInactive: Boolean): [VehicleModel!]!

        "Get all trims for a model (with option to include inactive)"
        garageAllTrims(modelId: ID!, includeInactive: Boolean): [VehicleTrim!]!

        "Get all engines for a trim (with option to include inactive)"
        garageAllEngines(trimId: ID!, includeInactive: Boolean): [VehicleEngine!]!

        "Get fitment rules for a product variant"
        fitmentByVariant(productVariantId: ID!): ProductFitmentList!

        "Search fitment rules with filters"
        searchFitmentRules(
            makeId: ID
            modelId: ID
            productId: ID
            skip: Int
            take: Int
        ): ProductFitmentList!
    }

    # ==========================================
    # Mutations
    # ==========================================

    extend type Mutation {
        # Vehicle Make CRUD
        createVehicleMake(input: CreateVehicleMakeInput!): VehicleMake!
        updateVehicleMake(id: ID!, input: UpdateVehicleMakeInput!): VehicleMake!
        deleteVehicleMake(id: ID!): Boolean!

        # Vehicle Model CRUD
        createVehicleModel(input: CreateVehicleModelInput!): VehicleModel!
        updateVehicleModel(id: ID!, input: UpdateVehicleModelInput!): VehicleModel!
        deleteVehicleModel(id: ID!): Boolean!

        # Vehicle Trim CRUD
        createVehicleTrim(input: CreateVehicleTrimInput!): VehicleTrim!
        updateVehicleTrim(id: ID!, input: UpdateVehicleTrimInput!): VehicleTrim!
        deleteVehicleTrim(id: ID!): Boolean!

        # Vehicle Engine CRUD
        createVehicleEngine(input: CreateVehicleEngineInput!): VehicleEngine!
        updateVehicleEngine(id: ID!, input: UpdateVehicleEngineInput!): VehicleEngine!
        deleteVehicleEngine(id: ID!): Boolean!

        # Product Fitment CRUD
        createProductFitment(input: CreateProductFitmentInput!): ProductFitment!
        updateProductFitment(id: ID!, input: UpdateProductFitmentInput!): ProductFitment!
        deleteProductFitment(id: ID!): Boolean!
        bulkUpsertFitment(entries: [BulkFitmentEntry!]!): ImportResult!

        # Import Operations
        importACESFile(fileContent: String!): ImportResult!
        importTaxonomyData(data: String!): ImportResult!
        seedVehicleTaxonomyFromFiles: ImportResult!
    }
`;
