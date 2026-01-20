# SCORM 1.2 Schemas

Including the original SCORM schemas optionally included in a CAM (Content Aggregation Model) Package (ZIP or PIF).
The DTD/XSD's in the root of the project are for SCORM 2004, and are also optionally included in packages to assist in validating the imsmanifest.xml.
There are subtle differences in the manifest files between SCORM 1.2 and 2004.

## This is not meant to be a definitive list of differences (just a example)
1. schemaversion: 'SCORM 1.2' vs '2004 3rd Edition' or '2004 4th Edition'
2. resource: 1.2 - scormtype vs 2004 scormType
3. Sequence and Navigation i.e. imsss:sequencing, SCORM 2004 Only
4. Noted XSDs work against SCORM 1.2 or SCORM 2004 for validation

Please remember most of the SCORM 1.2 specification namespace support on a learning platform is optional.
Mileage will vary depending on support.
