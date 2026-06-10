**Landsat-Based Land Cover Mapping Using Machine Learning and Google Earth Engine**

**Overview**

This repository presents a reproducible Google Earth Engine workflow for land cover classification using multispectral satellite imagery, topographic variables, and machine learning techniques. The workflow was developed to support environmental monitoring, landscape assessment, and land-use change analysis by generating spatially explicit land cover maps and quantitative area statistics. The methodology integrates Landsat 8 Surface Reflectance imagery, spectral indices, digital elevation data, and Random Forest classification to distinguish major land cover classes, including forest, sparse vegetation, bare ground, cropland, and artificial surfaces.

**Methodology**

**The workflow consists of the following major components:**

**1. Satellite Data Preprocessing**

      Acquisition of Landsat 8 Collection 2 Surface Reflectance imagery
      
      Cloud and cloud-shadow masking using QA bands

      Radiometric scaling and image correction

      Generation of median image composites to reduce atmospheric noise
      
**2. Feature Engineering**

Several spectral and environmental predictors were derived to improve class separability:

      NDVI (Normalized Difference Vegetation Index)
      
      NDWI (Normalized Difference Water Index)

      EVI (Enhanced Vegetation Index)

      BSI (Bare Soil Index)

      Elevation (ALOS AW3D30 Digital Surface Model)

      Slope

These variables further provide dynamic information on vegetation condition, surface moisture, bare soil exposure, and terrain characteristics.

**3. Machine Learning Classification**

A supervised Random Forest classifier was trained using reference samples representing different land cover categories. The workflow includes:

      Training-validation dataset partitioning

      Model training using spectral and topographic predictors

      Pixel-based land cover classification

      Independent validation using confusion matrices and accuracy assessment

**4. Spatial Analysis**

Following classification, the workflow calculates:

      Total forest area

      Sparse vegetation area

      Bare ground area

      Cropland area

      Artificial surface area

Area estimates are generated using pixel-based calculations and reported in hectares.

**5. Export and Visualization**

The final classified raster can be exported as a GeoTIFF for further GIS analysis and visualization.

**Applications**

This workflow can be adapted for:

      Land use and land cover mapping

      Urban expansion monitoring

      Vegetation assessment

      Watershed management

      Environmental impact assessment

      Climate adaptation and resilience planning

      Baseline spatial datasets for environmental modelling

**Technical Stack**

      Google Earth Engine (JavaScript API)

      Landsat 8 Collection 2 Surface Reflectance

      ALOS AW3D30 Digital Surface Model

      Random Forest Machine Learning Classifier

      Geospatial Statistics and Accuracy Assessment

**Key Outputs**

      Classified land cover maps

      Validation accuracy metrics

      Area statistics by land cover class

      GIS-ready GeoTIFF products
      
      Reproducible cloud-based geospatial workflow
