# Goal 

This is PoC setup with an API manager in conjunction with an Azure firewall. 
The setup is an API manager with several subnets in a VNet from where all traffic is routed through the Azure firewall. 

![Diagram](documents/PoC_APIM_Firewall_integration.png)

## Stack 
- Terraform 1.2+
- CDKTF version 0.11.2+
- Make 
- Typescript 4.7.4
- Developed on GNOME 4.3 and on MacOS 12 on M1
- Azure cli 2.38.0+
- Admin account on an Azure subscription

# Usage 

Install the stack and then login to the azure account you will use
```bash
az login 
```

Initialize the project 

```bash
make cdk_get 
```

Then deploy the stack  
(Note this will take about an hour)

```bash 
make cdk_deploy 
```

When done clean up with 

```bash
make cdk_destroy
```

(Or delete the resource group in the portal.)

# Settings 

Getting ms addresses from this article: 

https://techcommunity.microsoft.com/t5/azure-paas-blog/api-management-networking-faqs-demystifying-series-ii/ba-p/1502056

# Notes 

## Remove soft deleted api managers 
When deleting an API manager the manager is in a soft deleted state, for a time you can reactivate it. 
This means if you rerun the cdk stack again it may fail as the api manager name is still in use. You can delete 
the service through a special command as it will not show in the normal apim listing: 


List the deleted services with 

```bash
az apim deletedservice list
```

You get something like 

```json 
[
  {
    "deletionDate": "2022-07-08T05:02:53.339434+00:00",
    "id": "/subscriptions/lalalala/providers/Microsoft.ApiManagement/locations/eastus/deletedservices/PhiRoAPIMDemoMTFv1",
    "location": "East US",
    "name": "PhiRoAPIMdemov1",
    "scheduledPurgeDate": "2022-07-10T04:55:39.642152+00:00",
    "serviceId": "/subscriptions/lalalala/resourceGroups/mtf-poc-apim/providers/Microsoft.ApiManagement/service/PhiRoAPIMDemoMTFv1",
    "type": "Microsoft.ApiManagement/deletedservices"
  }
]

```

Then delete it with
```bash
az apim deletedservice purge --service-name PhiRoAPIdemov1 --location eastus
```

Of course the field name used in the command is different from the list output (`name` vs `service-name`) because reasons!

## stv1 or stv2 ? 

Does not show anywhere but in a specific version of the json view:
https://docs.microsoft.com/en-gb/azure/api-management/compute-infrastructure#how-do-i-know-which-platform-hosts-my-api-management-instance

