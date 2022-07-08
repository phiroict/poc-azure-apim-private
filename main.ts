import {Construct} from "constructs";
import {
    App,
    TerraformStack,
    TerraformOutput,
    AzurermBackend,
    Fn,
} from "cdktf";
import {
    ResourceGroup,
    Subnet,
    VirtualNetwork,
    AzurermProvider,
    ApiManagement,
    Firewall,
    PublicIp,
    RouteTable,
    Route,
    FirewallApplicationRuleCollection,
    /*SubnetRouteTableAssociation,*/
    NetworkSecurityGroup, SubnetNetworkSecurityGroupAssociation, ApiManagementGateway,
} from "./.gen/providers/azurerm";

class MyStack extends TerraformStack {
    constructor(scope: Construct, name: string) {
        super(scope, name);
        const resource_group = "demo-poc-apim";
        const control_plane_apim_ae = "52.224.186.99/32";  //East US ApiManagement.EastUS public ip address
        const global_env_apim = [
            "52.237.208.51/32",
            "52.237.215.149/32",
            "104.214.19.224/32",
            "52.162.110.80/32",
            control_plane_apim_ae
        ]

        new AzurermBackend(this, {
            resourceGroupName: "example-resource-group",
            storageAccountName: "myremotestateset",
            containerName: "tfstate",
            key: "demo_apim_poc.tfstate",
        });
        new AzurermProvider(this, "AzureRm", {
            features: {
                resourceGroup: {
                    preventDeletionIfContainsResources: false,
                },
            },
        });

        const rg = new ResourceGroup(this, "rg-demo-poc-aks", {
            name: resource_group,
            location: "eastus",
        });

        const network = new VirtualNetwork(this, "my-apim-network", {
            location: rg.location,
            name: "Mynetwork",
            resourceGroupName: rg.name,
            addressSpace: ["10.3.0.0/16"],
        });


        const subnet = new Subnet(this, "mydmz", {
            name: "MyDMZSubnet",
            addressPrefixes: ["10.3.12.0/24"],
            resourceGroupName: rg.name,
            virtualNetworkName: network.name,
        });

        const subnet_app = new Subnet(this, "myapp", {
            name: "MyAppSubnet",
            addressPrefixes: ["10.3.13.0/24"],
            resourceGroupName: rg.name,
            virtualNetworkName: network.name,
        });


        // This firewall subnet needs to have the name "AzureFirewallSubnet" to be set as the firewall subnet.
        const fw_subnet = new Subnet(this, "AzureFirewallSubnet", {
            name: "AzureFirewallSubnet",
            addressPrefixes: ["10.3.11.0/24"],
            resourceGroupName: rg.name,
            virtualNetworkName: network.name,
        });

        const sg_app = new NetworkSecurityGroup(this, "AppSG", {
            location: rg.location,
            name: "demo-poc-app-subnet-sg",
            resourceGroupName: rg.name,
            securityRule: [{
                name: "allow_https_traffid_in",
                access: "Allow",
                protocol: "Tcp",
                sourcePortRange: "443",
                sourceAddressPrefix: Fn.element(network.addressSpace, 0),
                destinationPortRange: "443",
                destinationAddressPrefix: Fn.element(subnet_app.addressPrefixes, 0),
                direction: "Inbound",
                priority: 300
            },
            {
                name: "allow_https_traffid_out",
                access: "Allow",
                protocol: "Tcp",
                sourcePortRange: "443",
                sourceAddressPrefix: Fn.element(subnet_app.addressPrefixes, 0),
                destinationPortRange: "443",
                destinationAddressPrefix: Fn.element(network.addressSpace, 0),
                direction: "Outbound",
                priority: 300
            }]
        });

        new SubnetNetworkSecurityGroupAssociation(this, "myapp_asc", {
            networkSecurityGroupId: sg_app.id,
            subnetId: subnet_app.id
        });

        const sg = new NetworkSecurityGroup(this, "APISG", {
            location: rg.location,
            name: "demo-poc-apim-subnet-sg",
            resourceGroupName: rg.name,
            securityRule: [
                {
                    name: "connect_out_3443",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "3443",
                    destinationPortRange: "3443",
                    destinationAddressPrefix: "*",
                    sourceAddressPrefix: "*",
                    direction: "Outbound",
                    priority: 100
                },
                {
                    name: "connect_out_1443",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "1443",
                    destinationPortRange: "1443",
                    destinationAddressPrefix: "*",
                    sourceAddressPrefix: "*",
                    direction: "Outbound",
                    priority: 101
                },
                {
                    name: "connect_out_443",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "443",
                    destinationPortRange: "443",
                    destinationAddressPrefix: "*",
                    sourceAddressPrefix: "*",
                    direction: "Outbound",
                    priority: 102
                },
                {
                    name: "connect_in_443",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "443",
                    destinationPortRange: "443",
                    destinationAddressPrefix: "*",
                    sourceAddressPrefix: "*",
                    direction: "Inbound",
                    priority: 100
                },
                {
                    name: "connect_in_3443",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "3443",
                    destinationPortRange: "3443",
                    destinationAddressPrefix: "VirtualNetwork",
                    sourceAddressPrefix: "ApiManagement",
                    direction: "Inbound",
                    priority: 101
                },
                {
                    name: "connect_in_6390",
                    access: "Allow",
                    protocol: "Tcp",
                    sourcePortRange: "6390",
                    destinationPortRange: "6390",
                    destinationAddressPrefix: "*",
                    sourceAddressPrefix: "*",
                    direction: "Inbound",
                    priority: 102
                }

            ]

        });

        //Assign the security group to the subnets.
        new SubnetNetworkSecurityGroupAssociation(this, "apim_subnet_dmz_sg", {
            networkSecurityGroupId: sg.id,
            subnetId: subnet.id
        });


        const pip = new PublicIp(this, "APIPA", {
            name: "apim-fw-pip",
            location: rg.location,
            resourceGroupName: rg.name,
            allocationMethod: "Static",
            sku: "Standard"
        });

        const firewall = new Firewall(this, "APIManagmentFirewall", {
            location: rg.location,
            name: "MTF-PoC-APIM-FW",
            skuName: "AZFW_VNet",
            skuTier: "Standard",
            resourceGroupName: rg.name,
            ipConfiguration: [{
                name: "configuration",
                subnetId: fw_subnet.id,
                publicIpAddressId: pip.id,
            }]
        });

        const routeTable = new RouteTable(this, "FW_Router", {
            location: rg.location,
            name: "demo-poc-apim-route-all-to-fw",
            resourceGroupName: rg.name
        });

        new Route(this, "route_to_fw", {
            //addressPrefix: Fn.element(network.addressSpace,0),
            addressPrefix: "0.0.0.0/0",
            name: "demo-poc-apim-routeall-fw",
            nextHopInIpAddress: firewall.ipConfiguration.get(0).privateIpAddress,
            nextHopType: "VirtualAppliance",
            resourceGroupName: rg.name,
            routeTableName: routeTable.name,
        });
        let ix = 0;
        for (const ip of global_env_apim) {
            new Route(this, "route_to_fw_apim_control" + ix, {
                //addressPrefix: Fn.element(network.addressSpace,0),
                addressPrefix: ip,
                name: "demo-poc-apim-control" + ix + "-fw",
                nextHopType: "Internet",
                resourceGroupName: rg.name,
                routeTableName: routeTable.name,
            });
            ++ix;
        }


        // new SubnetRouteTableAssociation(this, "default_route_subnet", {
        //     routeTableId: routeTable.id,
        //     subnetId: subnet.id,
        // })


        const apim = new ApiManagement(this, "myprivateapim", {
            name: "PhiRoAPIMDemoMTFv1",
            location: rg.location,
            resourceGroupName: rg.name,
            publisherName: "HarriesAPIEmporium",
            publisherEmail: "phil@phiroict.co.nz",
            skuName: "Developer_1",
            virtualNetworkType: "External",
            publicNetworkAccessEnabled: true,
            virtualNetworkConfiguration: {
                subnetId: subnet.id,
            },
        });

        new ApiManagementGateway(this, "api_gateway", {
            apiManagementId: apim.id,
            locationData: {
                name: "New Zealand Gateway"
            },
            name: "API-Gateway"
        })

        new FirewallApplicationRuleCollection(this, "firewall_rules_default", {
            action: "Allow",
            azureFirewallName: firewall.name,
            name: "Default_Allow_All_Rule",
            priority: 1000,
            resourceGroupName: rg.name,
            rule: [
                {
                    name: "allow_all_outgoing_SQLServer",
                    sourceAddresses: [Fn.element(network.addressSpace, 0)],
                    protocol: [{
                        port: 1433,
                        type: "Https"
                    }],
                    targetFqdns: ["*"],
                },
                {
                    name: "connect_to_management_interface",
                    sourceAddresses: ["0.0.0.0/0"],
                    protocol: [{
                        port: 3443,
                        type: "Https"
                    }],
                    targetFqdns: ["phiroapimdemodemov1.management.azure-api.net"]
                },
                {
                    name: "connect_to_developer_interface",
                    sourceAddresses: ["0.0.0.0/0"],
                    protocol: [{
                        port: 443,
                        type: "Https"
                    }],
                    targetFqdns: ["phiroapimdemodemov1.developer.azure-api.net"]
                },
                {
                    name: "connect_to_dewveloper_interface_users",
                    sourceAddresses: ["0.0.0.0/0"],
                    protocol: [{
                        port: 443,
                        type: "Https"
                    }],
                    targetFqdns: ["phiroapimdemodemov1.management.azure-api.net"]
                }]
        });


        new TerraformOutput(this, "apim_internal_addresess", {
            value: Fn.join(",", apim.privateIpAddresses),
        });
        new TerraformOutput(this, "firewall_external_addresess", {
            value: pip.ipAddress
        });


    }
}

const app = new App();
new MyStack(app, "demo-azure-apim-private");
app.synth();
